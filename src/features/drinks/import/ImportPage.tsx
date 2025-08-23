
import { importParties, importPartyDrinks } from "../db"; // adjust path if needed

export default function ImportPage() {
  // ...existing content...

  async function importFromPublic() {
    const [partiesRes, partyDrinksRes] = await Promise.all([
      fetch("./data/parties.json"),
      fetch("./data/partyDrinks.json"),
    ]);
    const parties = await partiesRes.json();
    const partyDrinks = await partyDrinksRes.json();
    await importParties(parties);
    await importPartyDrinks(partyDrinks);
    alert("Parties and Party→Drink links imported into Dexie.");
  }

  return (
    <section className="space-y-6">
      {/* ...existing UI... */}

      <div className="rounded border p-4">
        <h2 className="font-semibold mb-2">Import Parties & Assignments</h2>
        <p className="text-sm text-gray-600 mb-3">
          Reads <code>./data/parties.json</code> and <code>./data/partyDrinks.json</code> from your deployed site (or from <code>public/data</code> in dev).
        </p>
        <button onClick={importFromPublic} className="rounded bg-black text-white px-3 py-2">
          Import parties + assignments
        </button>
      </div>
    </section>
  );
}
