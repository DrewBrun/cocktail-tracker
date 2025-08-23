import { useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type PartyID } from "../features/drinks/db";
import { useEffect } from "react";

export default function PartyMenuPage() {
  const { id } = useParams(); // partyId from route
  const partyId = (id ?? "") as PartyID;

  const party = useLiveQuery(() => db.parties.get(partyId), [partyId]);
  const rows = useLiveQuery(() => db.partyDrinks.where("partyId").equals(partyId).toArray(), [partyId]);
  const drinks = useLiveQuery(async () => {
    if (!rows) return [];
    const ids = rows.map(r => r.drinkId);
    // fetch by slug first, fallback by string id
    const all = await db.drinks.toArray();
    return ids.map(id => all.find(d => d.slug === id || String(d.id) === id)).filter(Boolean);
  }, [rows]);

  useEffect(() => {
    // auto open print dialog when loaded
    if (party && drinks) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [party, drinks]);

  if (!party) return <div className="p-6">Loading party…</div>;

  return (
    <div className="p-8 print:p-0 print:m-0">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-semibold">{party.title ?? party.name}</h1>
          {party.tagline && <div className="text-gray-600 mt-1">{party.tagline}</div>}
          {party.date && <div className="text-gray-500 text-sm mt-1">{party.date}</div>}
        </header>

        <ul className="space-y-3">
          {drinks?.map((d) => (
            <li key={d!.slug ?? String(d!.id)} className="border-b pb-2">
              <div className="font-medium">{d!.title ?? d!.slug ?? d!.id}</div>
              {d!.ingredients && <div className="text-sm text-gray-600">{d!.ingredients}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
