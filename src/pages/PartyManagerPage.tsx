// src/pages/PartyManagerPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { db, type Party, type PartyID, makeSlug } from "../features/drinks/db";
import { useDrinks } from "../hooks/useDrinks";
import { useParties } from "../features/parties/useParties";
import { usePartyAssignments } from "../features/parties/usePartyAssignments";
import { upsertParty, setPartyAssignments } from "../features/data/writeApi";

// Helper to resolve the deployed data base URL
function getDataBaseUrl() {
  const env = (import.meta as any).env;
  const base = (env && env.VITE_DATA_BASE_URL) ? String(env.VITE_DATA_BASE_URL) : "";
  const trimmed = base.replace(/\/$/, "");
  if (trimmed) return trimmed; // e.g. /cocktails2/data
  // Fallback: infer from current location + '/data'
  const path = (typeof window !== "undefined") ? window.location.pathname : "/";
  const prefix = path.endsWith("/") ? path : (path + "/");
  return prefix + "data";
}

function cacheBust(u: string) {
  return u + (u.includes("?") ? "&" : "?") + "ts=" + Date.now();
}

async function generatePartyId(): Promise<PartyID> {
  // short, collision-resistant id
  let id = Math.random().toString(36).slice(2, 10);
  let tries = 0;
  while (tries < 5 && (await db.parties.get(id))) {
    id = Math.random().toString(36).slice(2, 10);
    tries++;
  }
  return id as PartyID;
}

export default function PartyManagerPage() {
  // Drinks: cache-first + refresh behaves like rest of app
  const { drinks } = useDrinks();

  // Parties: hook (uses cache-first strategy)
  const { parties, reload: reloadParties } = useParties();

  const [selectedPartyId, setSelectedPartyId] = useState<PartyID | null>(null);
  const selectedParty = useMemo(
    () => parties.find(p => p.id === selectedPartyId) ?? null,
    [parties, selectedPartyId]
  );

  // Assignments for selected party (cache-first + refresh)
  const { assignments, reload: reloadAssignments } = usePartyAssignments(selectedPartyId ?? undefined);
  const dbAssignedSet = useMemo(() => new Set(assignments.map(r => r.drinkId)), [assignments]);

  // ✅ Pending selection state (decoupled from Dexie). Checkboxes update this only.
  const [pendingAssigned, setPendingAssigned] = useState<Set<string>>(new Set());
  // Sync pending from DB when the party (or its assignments) change
  useEffect(() => {
    setPendingAssigned(new Set(dbAssignedSet));
  }, [selectedPartyId, assignments]);

  // Party form (for editing existing)
  const [form, setForm] = useState<Partial<Party>>({ name: "", date: "", tagline: "", title: "" });
  useEffect(() => {
    if (selectedParty) {
      setForm({
        name: selectedParty.name,
        date: selectedParty.date ?? "",
        tagline: selectedParty.tagline ?? "",
        title: selectedParty.title ?? "",
      });
    }
  }, [selectedPartyId]); // eslint-disable-line

  // ⚡ Force refresh from canonical JSON, bypassing caches, then repopulate Dexie.
  async function forceRefreshAll() {
    const base = getDataBaseUrl();
    try {
      const [partiesRes, pdRes] = await Promise.all([
        fetch(cacheBust(`${base}/parties.json`), { cache: "no-store" }),
        fetch(cacheBust(`${base}/partyDrinks.json`), { cache: "no-store" }),
      ]);
      if (!partiesRes.ok) throw new Error(`Failed to fetch parties.json (${partiesRes.status})`);
      if (!pdRes.ok) throw new Error(`Failed to fetch partyDrinks.json (${pdRes.status})`);
      const partiesJson = await partiesRes.json();
      const partyDrinksJson = await pdRes.json();
      const partiesArr: any[] = Array.isArray(partiesJson) ? partiesJson : (partiesJson?.parties ?? []);
      const partyDrinksArr: any[] = Array.isArray(partyDrinksJson) ? partyDrinksJson : (partyDrinksJson?.partyDrinks ?? []);

      await db.transaction("rw", db.parties, db.partyDrinks, async () => {
        await db.parties.clear();
        await db.partyDrinks.clear();

        // Upsert parties
        for (const p of partiesArr) {
          const row: Party = {
            id: String(p.id),
            name: p.name ?? "",
            date: p.date ?? null,
            tagline: p.tagline ?? null,
            title: p.title ?? p.name ?? "",
            slug: p.slug ?? makeSlug(p.title ?? p.name ?? ""),
            createdAt: p.createdAt ?? Date.now(),
            updatedAt: p.updatedAt ?? Date.now(),
          };
          await db.parties.put(row);
        }

        // Upsert assignments
        for (const r of partyDrinksArr) {
          if (!r || r.partyId == null || r.drinkId == null) continue;
          await db.partyDrinks.add({
            partyId: String(r.partyId),
            drinkId: String(r.drinkId),
            addedAt: r.addedAt ?? Date.now(),
          });
        }
      });

      // Ask hooks to pull from Dexie again (their cache-first step will pick it up)
      await reloadParties();
      await reloadAssignments();
    } catch (err: any) {
      console.error(err);
      alert("Force refresh failed: " + (err?.message || String(err)));
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // NEW PARTY DIALOG
  // ────────────────────────────────────────────────────────────────────────────
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTagline, setNewTagline] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [duplicateFromSelected, setDuplicateFromSelected] = useState(false);
  const [creating, setCreating] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (newOpen) setTimeout(() => nameRef.current?.focus(), 50);
  }, [newOpen]);

  function openNewDialog() {
    setNewName("");
    setNewDate("");
    setNewTagline("");
    setNewTitle("");
    setDuplicateFromSelected(false);
    setNewOpen(true);
  }

  function closeNewDialog() {
    if (creating) return; // prevent closing while writing
    setNewOpen(false);
  }

  async function confirmCreateParty() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const id = await generatePartyId();
      const now = Date.now();
      const party: Party = {
        id,
        name: newName.trim(),
        date: newDate ? newDate : null,
        tagline: newTagline ? newTagline : null,
        title: newTitle.trim() || newName.trim(),
        slug: makeSlug(newTitle || newName),
        createdAt: now,
        updatedAt: now,
      };

      // local first
      await db.parties.add(party);

      // duplicate assignments from selected party if requested
      if (duplicateFromSelected && selectedPartyId) {
        const rows = await db.partyDrinks.where("partyId").equals(selectedPartyId).toArray();
        if (rows.length) {
          await db.partyDrinks.bulkAdd(rows.map(r => ({ partyId: id, drinkId: r.drinkId, addedAt: Date.now() })));
        }
      }

      setSelectedPartyId(id);

      // remote write(s)
      await upsertParty({ id: party.id, party });
      if (duplicateFromSelected && selectedPartyId) {
        const rows = await db.partyDrinks.where("partyId").equals(id).toArray();
        const ids = rows.map(r => r.drinkId);
        await setPartyAssignments(id, ids);
      }

      // hard re-sync from JSON
      await forceRefreshAll();
      setNewOpen(false);
    } catch (err: any) {
      console.error(err);
      alert("Create party failed: " + (err?.message || String(err)));
    } finally {
      setCreating(false);
    }
  }

  async function saveParty() {
    if (!selectedParty) return;
    const updated: Party = {
      ...selectedParty,
      name: form.name?.trim() || selectedParty.name,
      date: form.date || null,
      tagline: form.tagline || null,
      title: form.title || form.name || selectedParty.title,
      slug: makeSlug(form.title || form.name || selectedParty.slug),
      updatedAt: Date.now(),
    };

    // local update
    await db.parties.put(updated);

    // remote write + hard re-sync
    await upsertParty({ id: updated.id, party: updated });
    await forceRefreshAll();
  }

  // ✅ Save Assignments: commit PENDING → Dexie, then write JSON
  async function saveAssignments() {
    if (!selectedPartyId) return;

    const selectedDrinkIds = Array.from(pendingAssigned);

    // Replace this party's assignments in Dexie with the pending set
    await db.transaction("rw", db.partyDrinks, async () => {
      const toDelete = await db.partyDrinks.where("partyId").equals(selectedPartyId).toArray();
      await db.partyDrinks.bulkDelete(toDelete.map(r => [r.partyId, r.drinkId] as [string, string]));
      if (selectedDrinkIds.length) {
        await db.partyDrinks.bulkAdd(
          selectedDrinkIds.map(id => ({ partyId: selectedPartyId, drinkId: id, addedAt: Date.now() }))
        );
      }
    });

    // Write canonical JSON via Lambda, then refresh
    await setPartyAssignments(selectedPartyId, selectedDrinkIds);
    await forceRefreshAll();
  }

  // Update pending selection when a checkbox changes (no DB writes here)
  function togglePending(drinkId: string, checked: boolean) {
    setPendingAssigned(prev => {
      const next = new Set(prev);
      if (checked) next.add(drinkId); else next.delete(drinkId);
      return next;
    });
  }

  // Search
  const [q, setQ] = useState("");
  const filteredDrinks = useMemo(() => {
    const list = drinks ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((d: any) => {
      const title = (d.title ?? "").toLowerCase();
      const slug  = (d.slug  ?? "").toLowerCase();
      const ingredientsText = Array.isArray(d.ingredients)
        ? d.ingredients.join(", ")
        : (d.ingredients ?? "");
      const ing = ingredientsText.toLowerCase();
      return title.includes(needle) || slug.includes(needle) || ing.includes(needle);
    });
  }, [drinks, q]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Party Manager</h1>

      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Select Party</label>
          <select
            className="border rounded px-2 py-1 min-w-[280px]"
            value={selectedPartyId ?? ""}
            onChange={(e) => setSelectedPartyId((e.target.value || null) as PartyID | null)}
          >
            <option value="">— Choose a party —</option>
            {parties.map(p => (
              <option key={p.id} value={p.id}>{p.title ?? p.name} ({p.id})</option>
            ))}
          </select>
        </div>

        <button className="rounded bg-black text-white px-3 py-2" onClick={openNewDialog}>
          + New Party
        </button>

        {selectedParty && (
          <a className="underline ml-auto" href={`#/parties/${selectedParty.id}/menu`} target="_blank" rel="noreferrer">
            Open Printable Menu →
          </a>
        )}
      </div>

      {selectedParty && (
        <div className="rounded border p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LabeledInput label="Name" value={form.name ?? ""} onChange={v => setForm(f => ({ ...f, name: v }))} />
            <LabeledInput label="Date (YYYY-MM-DD)" value={form.date ?? ""} onChange={v => setForm(f => ({ ...f, date: v }))} />
            <LabeledInput label="Tagline" value={form.tagline ?? ""} onChange={v => setForm(f => ({ ...f, tagline: v }))} />
            <LabeledInput label="Title (display)" value={form.title ?? ""} onChange={v => setForm(f => ({ ...f, title: v }))} />
          </div>

          <div className="flex gap-2">
            <button className="rounded bg-black text-white px-3 py-2" onClick={saveParty}>Save Party</button>
            <button className="rounded border px-3 py-2" onClick={forceRefreshAll}>Force refresh from JSON</button>
          </div>
        </div>
      )}

      {selectedParty && (
        <div className="rounded border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Assign Drinks</h2>
            <div className="flex items-center gap-3">
              <input className="border rounded px-2 py-1" placeholder="Search drinks…" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="rounded bg-black text-white px-3 py-2" onClick={saveAssignments}>Save Assignments</button>
            </div>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {filteredDrinks.map((d: any) => {
              const drinkId = d.slug ?? String(d.id);
              const isChecked = pendingAssigned.has(drinkId);
              return (
                <li key={drinkId} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={!!isChecked}
                    onChange={(e) => togglePending(drinkId, e.target.checked)}
                  />
                  <span className="truncate">{d.title ?? drinkId}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* New Party Modal */}
      {newOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeNewDialog}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-3">Create New Party</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <label className="block">
                <div className="text-sm text-gray-700 mb-1">Name</div>
                <input ref={nameRef} className="border rounded w-full px-2 py-1" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </label>
              <label className="block">
                <div className="text-sm text-gray-700 mb-1">Date (YYYY-MM-DD)</div>
                <input className="border rounded w-full px-2 py-1" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <div className="text-sm text-gray-700 mb-1">Title (display)</div>
                <input className="border rounded w-full px-2 py-1" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <div className="text-sm text-gray-700 mb-1">Tagline</div>
                <input className="border rounded w-full px-2 py-1" value={newTagline} onChange={(e) => setNewTagline(e.target.value)} />
              </label>
            </div>

            <label className="inline-flex items-center gap-2 mb-4">
              <input type="checkbox" checked={duplicateFromSelected} onChange={(e) => setDuplicateFromSelected(e.target.checked)} />
              <span className="text-sm">Duplicate drink assignments from the currently selected party</span>
            </label>

            <div className="flex justify-end gap-2">
              <button className="rounded border px-3 py-2" onClick={closeNewDialog} disabled={creating}>Cancel</button>
              <button
                className="rounded bg-black text-white px-3 py-2 disabled:opacity-50"
                onClick={confirmCreateParty}
                disabled={!newName.trim() || creating}
              >
                {creating ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LabeledInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="text-sm text-gray-700 mb-1">{label}</div>
      <input className="border rounded w-full px-2 py-1" value={value} onChange={e => onChange(e.target.value)} />
    </label>
  );
}
