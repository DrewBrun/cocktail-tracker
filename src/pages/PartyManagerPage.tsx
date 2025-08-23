// src/pages/PartyManagerPage.tsx
import { useEffect, useMemo, useState } from "react";
import { db, type Party, type PartyID, makeSlug } from "../features/drinks/db";
import { useDrinks } from "../hooks/useDrinks";
import { useParties } from "../features/parties/useParties";
import { usePartyAssignments } from "../features/parties/usePartyAssignments";
import { upsertParty, setPartyAssignments } from "../features/data/writeApi";

export default function PartyManagerPage() {
  // Drinks: cache-first + refresh behaves like rest of app
  const { drinks } = useDrinks();

  // Parties: new hook, cache-first + refresh from /data/parties.json
  const { parties, reload: reloadParties } = useParties();

  const [selectedPartyId, setSelectedPartyId] = useState<PartyID | null>(null);
  const selectedParty = useMemo(
    () => parties.find(p => p.id === selectedPartyId) ?? null,
    [parties, selectedPartyId]
  );

  // Assignments for selected party (cache-first + refresh from /data/partyDrinks.json)
  const { assignments, reload: reloadAssignments } = usePartyAssignments(selectedPartyId ?? undefined);
  const assignedSet = useMemo(() => new Set(assignments.map(r => r.drinkId)), [assignments]);

  // Party form
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

  async function createParty() {
    const now = Date.now();
    const id: PartyID = crypto.randomUUID().slice(0, 8);
    const party: Party = {
      id,
      name: form.name?.trim() || "New Party",
      date: form.date || null,
      tagline: form.tagline || null,
      title: form.title || form.name || "Party",
      slug: makeSlug(form.title || form.name),
      createdAt: now,
      updatedAt: now,
    };

    // local first (so UI updates immediately)
    await db.parties.add(party);
    setSelectedPartyId(id);

    // remote write (updates JSON via Lambda), then re-sync from JSON
    await upsertParty({ id: party.id, party });

    await reloadParties();
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

    // remote write + re-sync
await upsertParty({ id: updated.id, party: updated });
    await reloadParties();
  }

  // Batch-save current assignments to server JSON, like the Drinks editor flow
  async function saveAssignments() {
    if (!selectedPartyId) return;

    // derive current selection from checkboxes in UI state
    // (assignedSet already reflects Dexie; we recompute from the DOM list below)
    const selectedDrinkIds = filteredDrinks.map(d => {
      const id = d.slug ?? String(d.id);
      return assignedSet.has(id) ? id : null;
    }).filter(Boolean) as string[];

    // remote write (replaces that party’s list in JSON)
    await setPartyAssignments(selectedPartyId, selectedDrinkIds);

    // local refresh from JSON
    await reloadAssignments();
  }

  // Toggle an assignment locally (immediate UX)
  async function toggleAssignment(drinkId: string, checked: boolean) {
    if (!selectedPartyId) return;
    if (checked) {
      const exists = await db.partyDrinks.where({ partyId: selectedPartyId, drinkId }).first();
      if (!exists) await db.partyDrinks.add({ partyId: selectedPartyId, drinkId, addedAt: Date.now() });
    } else {
      const rows = await db.partyDrinks.where({ partyId: selectedPartyId, drinkId }).toArray();
      await db.partyDrinks.bulkDelete(rows.map((r) => [r.partyId, r.drinkId] as [string, string]));
    }
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

        <button className="rounded bg-black text-white px-3 py-2" onClick={createParty}>
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
            <button className="rounded border px-3 py-2" onClick={() => reloadParties()}>Reload from JSON</button>
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
              const isChecked = assignedSet.has(drinkId);
              return (
                <li key={drinkId} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={!!isChecked}
                    onChange={(e) => toggleAssignment(drinkId, e.target.checked)}
                  />
                  <span className="truncate">{d.title ?? drinkId}</span>
                </li>
              );
            })}
          </ul>
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
