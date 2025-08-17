// src/pages/DrinkBrowsePage.tsx
import { useMemo } from "react";
import { useDrinks } from "../hooks/useDrinks";
import DrinkGrid from "../components/DrinkGrid";
import FiltersBar from "../components/FiltersBar";
import SearchBar from "../components/SearchBar";
import { useUrlFilters } from "../features/drinks/filters/useUrlFilters";
import { useFiltersOpen } from "../features/drinks/filters/useFiltersOpen";

export default function DrinkBrowsePage() {
  const { drinks, loading, error, reload } = useDrinks();
  const [filters, setFilters] = useUrlFilters();
  const [filtersOpen, setFiltersOpen] = useFiltersOpen();

  const activeAdvanced =
    (filters.selected ? 1 : 0) + filters.ingredients.length;

  const filtered = useMemo(() => {
    const s = filters.q.trim().toLowerCase();
    const ing = filters.ingredients.map(x => x.toLowerCase());

    return drinks
      .filter(d => {
        const blob = `${d.title ?? ""} ${d.description ?? ""} ${d.recipe ?? ""} ${d.comments ?? ""}`.toLowerCase();
        const matchesQ = !s || blob.includes(s);
        const matchesIng = ing.length === 0 ||
          ing.some(t => (d.ingredients ?? []).map(x => x.toLowerCase()).includes(t));
        const matchesFav = !filters.selected || d.selected === true;
        return matchesQ && matchesIng && matchesFav;
      })
      .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }, [drinks, filters]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Drew&apos;s Cocktail List</h1>
          <p className="text-sm text-gray-500">Time for a little top up!</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Search is always visible */}
          <SearchBar q={filters.q} onChange={(q) => setFilters({ q })} />

          {/* Toggle only affects advanced filters */}
          <button
            className="rounded-2xl border px-3 py-2 text-sm"
            onClick={() => setFiltersOpen(!filtersOpen)}
            title={filtersOpen ? "Hide filters" : "Show filters"}
          >
            {filtersOpen ? "Hide Filters" : "Show Filters"}
            {activeAdvanced > 0 && (
              <span className="ml-2 rounded-full border px-2 py-0.5 text-xs">
                {activeAdvanced}
              </span>
            )}
          </button>

          <button className="rounded-2xl border px-3 py-2 text-sm" onClick={reload}>
            Reload
          </button>
        </div>
      </div>

      {filtersOpen && (
        <FiltersBar
          compact
          selected={filters.selected}
          onSelectedChange={(v) => setFilters({ selected: v })}
          ingredients={filters.ingredients}
          onIngredientsChange={(v) => setFilters({ ingredients: v })}
          corpus={drinks}
        />
      )}

      {loading && <div className="rounded-2xl border bg-white p-4 text-sm text-gray-600">Loading drinks…</div>}
      {error && <div className="rounded-2xl border bg-white p-4 text-sm text-red-700">Failed to load: {error}</div>}
      {!loading && !error && filtered.length > 0 && <DrinkGrid drinks={filtered} />}
      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-2xl border bg-white p-4 text-center text-gray-500">
          No matches. Try adjusting search or filters.
        </div>
      )}
    </div>
  );
}
