// Helpers for filtering drinks, now supporting an ANY/ALL ingredient mode.

export type Drink = {
  id?: string;
  name?: string;
  title?: string;
  notes?: string;
  description?: string;
  recipe?: string;
  comments?: string;
  ingredients?: (string | { name: string })[];
  favorite?: boolean;
  selected?: boolean;
};

export type IngredientMode = "all" | "any";

function normalize(s: string) {
  return (s ?? "").trim().toLowerCase();
}

function toIngStrings(drink: Drink) {
  return (drink.ingredients ?? []).map((x) =>
    typeof x === "string" ? x.toLowerCase() : (x?.name ?? "").toLowerCase()
  );
}

export function matchesIngredients(
  drink: Drink,
  selected: string[],
  mode: IngredientMode = "all"
) {
  if (!selected?.length) return true;
  const have = toIngStrings(drink);
  return mode === "all"
    ? selected.every((s) => have.includes(s.toLowerCase()))
    : selected.some((s) => have.includes(s.toLowerCase()));
}

export type FilterState = {
  q?: string;
  ingredients: string[];
  selected: boolean; // favorites
  ingredientMode?: IngredientMode; // NEW (defaults to "all")
};

export function selectFilteredDrinks(drinks: Drink[], filters: FilterState) {
  const q = normalize(filters.q ?? "");
  const mode: IngredientMode = filters.ingredientMode ?? "all";

  return (drinks ?? [])
    .filter((d) => {
      const blob = normalize(
        `${d.name ?? d.title ?? ""} ${d.notes ?? ""} ${d.description ?? ""} ${d.recipe ?? ""} ${d.comments ?? ""}`
      );
      const matchesQ = !q || blob.includes(q);

      const matchesIng = matchesIngredients(d, filters.ingredients ?? [], mode);

      const isFav = d.favorite === true || d.selected === true;
      const matchesFav = !filters.selected || isFav;

      return matchesQ && matchesIng && matchesFav;
    })
    .sort((a, b) =>
      (a.title ?? a.name ?? "").localeCompare(b.title ?? b.name ?? "")
    );
}