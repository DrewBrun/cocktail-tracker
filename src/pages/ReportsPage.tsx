// src/pages/ReportsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { mostMadeDrinks, ingredientUsage, presetToRange, type DateRange } from "../features/drinks/reports";

type Preset = "30" | "90" | "ytd" | "all";



export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("30");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const range: DateRange = useMemo(() => {
    if (customFrom || customTo) {
      const from = customFrom ? Date.parse(customFrom) : null;
      const to = customTo ? Date.parse(customTo) : null;
      return { from, to };
    }
    return presetToRange(preset);
  }, [preset, customFrom, customTo]);

  const [topDrinks, setTopDrinks] = useState<Array<{ name: string; slug: string; count: number }>>([]);
  const [ingredients, setIngredients] = useState<Array<{ ingredient: string; count: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [dRows, iRows] = await Promise.all([
          mostMadeDrinks(range),
          ingredientUsage(range),
        ]);
        if (!isCancelled) {
          setTopDrinks(dRows);
          setIngredients(iRows);
          setErr(null);
        }
      } catch (e: any) {
        if (!isCancelled) setErr(e?.message ?? "Failed to load reports");
      } finally {
        if (!isCancelled) setLoading(false);
      }
    })();
    return () => { isCancelled = true; };
  }, [range]);

  return (
    <div className="mx-auto max-w-6xl p-4 space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">Reports</h1>
        <p className="text-sm text-gray-400">time for a little top up</p>
      </header>

      {/* Filters */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div className="space-y-2">
          <label className="text-sm font-medium">Quick Range</label>
          <div className="grid grid-cols-4 gap-2">
            {(["30","90","ytd","all"] as Preset[]).map(p => (
              <button
                key={p}
                onClick={() => { setPreset(p); setCustomFrom(""); setCustomTo(""); }}
                className={`px-3 py-2 rounded-xl border text-sm ${preset===p && !customFrom && !customTo ? "border-black" : "border-gray-300"}`}
                aria-pressed={preset===p && !customFrom && !customTo}
              >
                {p==="30" ? "Last 30" : p==="90" ? "Last 90" : p==="ytd" ? "YTD" : "All time"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Custom From</label>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Custom To</label>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="w-full rounded-xl border border-gray-300 px-3 py-2"
          />
        </div>
      </section>

      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {err && <div className="text-sm text-red-600">Error: {err}</div>}

      {/* Most-made Drinks */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Most-made Drinks</h2>
        <div className="overflow-x-auto rounded-2xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Drink</th>
                <th className="px-3 py-2 text-right">Times Made</th>
              </tr>
            </thead>
            <tbody>
              {topDrinks.map((r, i) => (
                <tr key={r.slug} className="border-t">
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-right">{r.count}</td>
                </tr>
              ))}
              {!loading && topDrinks.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-500">No data in this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ingredient Usage */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Ingredient Usage</h2>
        <div className="overflow-x-auto rounded-2xl border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Ingredient</th>
                <th className="px-3 py-2 text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((r) => (
                <tr key={r.ingredient} className="border-t">
                  <td className="px-3 py-2">{r.ingredient}</td>
                  <td className="px-3 py-2 text-right">{r.count}</td>
                </tr>
              ))}
              {!loading && ingredients.length === 0 && (
                <tr><td colSpan={2} className="px-3 py-4 text-center text-gray-500">No data in this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
