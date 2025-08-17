// src/components/FiltersBar.tsx with summary only (toggle removed here — use header button)

import { useMemo, useState } from "react";

export type FiltersBarProps = {
  selected: boolean;
  onSelectedChange: (v: boolean) => void;
  ingredients: string[];
  onIngredientsChange: (v: string[]) => void;
  corpus: Array<{
    title?: string;
    description?: string;
    recipe?: string;
    comments?: string;
    ingredients?: string[];
  }>;
  compact?: boolean;
};

function toggle(list: string[], item: string) {
  const set = new Set(list.map((x) => x.toLowerCase()));
  const key = item.toLowerCase();
  if (set.has(key)) set.delete(key); else set.add(key);
  return Array.from(set);
}

export default function FiltersBar({
  selected,
  onSelectedChange,
  ingredients,
  onIngredientsChange,
  corpus,
  compact = false,
}: FiltersBarProps) {
  const [ingInput, setIngInput] = useState("");

  // Build suggestions from normalized ingredients if available; otherwise fall back to a small seed scan
  const suggestions = useMemo(() => {
    const counts = new Map<string, number>();

    const add = (token?: string) => {
      if (!token) return;
      const k = token.toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    };

    corpus.forEach((d) => {
      if (d.ingredients && d.ingredients.length) {
        d.ingredients.forEach(add);
      } else {
        const text = `${d.title ?? ""} ${d.description ?? ""} ${d.recipe ?? ""} ${d.comments ?? ""}`.toLowerCase();
        [
          "gin","rye","bourbon","whiskey","rum","tequila","vodka","cognac","brandy","scotch",
          "campari","cynar","chartreuse","maraschino","vermouth","aperol","sherry","amaro",
          "lime","lemon","grapefruit","orgeat","honey","falernum","bitters","grenadine","syrup",
        ].forEach((seed) => {
          if (text.includes(seed)) add(seed);
        });
      }
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
      .map(([k]) => k);
  }, [corpus]);

  const addIng = () => {
    const parts = ingInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) onIngredientsChange(Array.from(new Set([...ingredients, ...parts])));
    setIngInput("");
  };

  const clearAdvanced = () => {
    onSelectedChange(false);
    onIngredientsChange([]);
  };

  return (
    <div className={`rounded-2xl border bg-white ${compact ? "p-3 space-y-2" : "p-4 space-y-3"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelectedChange(e.target.checked)}
          />
          ★ Selected
        </label>

        <div className="flex items-center gap-2">
          <input
            aria-label="Ingredients filter"
            placeholder="ingredients (comma separated)"
            value={ingInput}
            onChange={(e) => setIngInput(e.target.value)}
            className="rounded-xl border px-3 py-2"
            onKeyDown={(e) => e.key === "Enter" && addIng()}
          />
          <button className="rounded-xl border px-3 py-2 text-sm" onClick={addIng}>
            Add
          </button>
          <button className="rounded-xl border px-3 py-2 text-sm" onClick={clearAdvanced}>
            Clear
          </button>
        </div>
      </div>

      {/* Active ingredient chips */}
      {ingredients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ingredients.map((ing) => (
            <button
              key={ing}
              onClick={() => onIngredientsChange(toggle(ingredients, ing))}
              className="rounded-full border px-3 py-1 text-xs bg-gray-50 hover:bg-gray-100"
              aria-label={`Remove ${ing}`}
              title="Click to remove"
            >
              {ing} ×
            </button>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => {
            const active = ingredients.map((i) => i.toLowerCase()).includes(s);
            return (
              <button
                key={s}
                onClick={() => onIngredientsChange(toggle(ingredients, s))}
                className={`rounded-full border px-3 py-1 text-xs ${
                  active ? "bg-blue-50 border-blue-300" : "bg-gray-50 hover:bg-gray-100"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
