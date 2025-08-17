import { useSearchParams } from "react-router-dom";

export type FilterState = {
  q: string;
  ingredients: string[];   // ["gin","lemon"]
  selected: boolean;       // ★ favorites only
};

function splitList(v: string | null) {
  return v ? v.split(",").map(s => s.trim()).filter(Boolean) : [];
}

export function useUrlFilters() {
  const [sp, setSp] = useSearchParams();

  const state: FilterState = {
    q: sp.get("q") ?? "",
    ingredients: splitList(sp.get("ing")),
    selected: sp.get("fav") === "1",
  };

  const update = (patch: Partial<FilterState>) => {
    const next = new URLSearchParams(sp);
    if (patch.q !== undefined) {
      patch.q ? next.set("q", patch.q) : next.delete("q");
    }
    if (patch.selected !== undefined) {
      patch.selected ? next.set("fav", "1") : next.delete("fav");
    }
    if (patch.ingredients !== undefined) {
      patch.ingredients.length ? next.set("ing", patch.ingredients.join(",")) : next.delete("ing");
    }
    setSp(next, { replace: true });
  };

  return [state, update] as const;
}
