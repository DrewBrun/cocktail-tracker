import { useEffect, useMemo, useState } from "react";
import { db, type Party, makeSlug } from "../features/drinks/db";
import { useLiveQuery } from "dexie-react-hooks";

export default function PartyManagerPage() {
  const parties = useLiveQuery(() => db.parties.orderBy("createdAt").reverse().toArray(), []);
  const drinks = useLiveQuery(() => db.drinks.toArray(), []);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const selectedParty = parties?.find(p => p.id === selectedPartyId) ?? null;

  const assignedSet = useLiveQuery(async () => {
    if (!selectedPartyId) return new Set<string>();
    const rows = await db.partyDrinks.where("partyId").equals(selectedPartyId).toArray();
    return new Set(rows.map(r => r.drinkId));
  }, [selectedPartyId]);

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
    const id = crypto.randomUUID().slice(0, 8); // short ID for convenience
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
    await db.parties.add(party);
    setSelectedPartyId(id);
  }

  async function saveParty() {
    if (!selectedParty) return;
    const updated = {
      ...selectedParty,
      name: form.name?.trim() || selectedParty.name,
      date: form.date || null,
      tagline: form.tagline || null,
      title: form.title || form.name || selectedParty.title,
      slug: makeSlug(form.title || form.name || selectedParty.slug),
      updatedAt: Date.now(),
    };
    await db.parties.put(updated);
  }

  async function toggleAssignment(drinkId: string, checked: boolean) {
    if (!selectedPartyId) return;
    if (checked) {
      const exists = await db.partyDrinks.where({ partyId: selectedPartyId, drinkId }).first();
      if (!exists) await db.partyDrinks.add({ partyId: selectedPartyId, drinkId, addedAt: Date.now() });
    } else {
      const rows = await db.partyDrinks.where({ partyId: selectedPartyId, drinkId }).toArray();
      await db.partyDrinks.bulkDelete(rows.map(r => [r.partyId, r.drinkId] as any)); // composite key not used; fallback to delete by keys
      // If your table uses auto-increment PK, replace with bulkDelete(rows.map(r => r.id))
    }
  }

  const [q, setQ] = useState("");
const filteredDrinks = useMemo(() => {
  if (!drinks) return [];
  const needle = q.trim().toLowerCase();
  if (!needle) return drinks;

  return drinks.filter(d => {
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

      {/* select or create party */}
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Select Party</label>
          <select
            className="border rounded px-2 py-1 min-w-[280px]"
            value={selectedPartyId ?? ""}
            onChange={(e) => setSelectedPartyId(e.target.value || null)}
          >
            <option value="">— Choose a party —</option>
            {parties?.map(p => (
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

      {/* party details */}
      {selectedParty && (
        <div className="rounded border p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LabeledInput label="Name" value={form.name ?? ""} onChange={v => setForm(f => ({ ...f, name: v }))} />
            <LabeledInput label="Date (YYYY-MM-DD)" value={form.date ?? ""} onChange={v => setForm(f => ({ ...f, date: v }))} />
            <LabeledInput label="Tagline" value={form.tagline ?? ""} onChange={v => setForm(f => ({ ...f, tagline: v }))} />
            <LabeledInput label="Title (display)" value={form.title ?? ""} onChange={v => setForm(f => ({ ...f, title: v }))} />
          </div>
          <button className="rounded bg-black text-white px-3 py-2" onClick={saveParty}>Save Party</button>
        </div>
      )}

      {/* assign drinks */}
      {selectedParty && (
        <div className="rounded border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Assign Drinks</h2>
            <input
              className="border rounded px-2 py-1"
              placeholder="Search drinks…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {filteredDrinks?.map(d => {
              const isChecked = assignedSet?.has(d.slug ?? String(d.id));
              const drinkId = d.slug ?? String(d.id);
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
