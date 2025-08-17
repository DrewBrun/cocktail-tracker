// src/lib/normalize.ts
import type { Drink } from "./types";
import { KNOWN_INGREDIENTS, CATEGORY_RULES } from "../features/drinks/constants";

const cleanStr = (v?: string): string => (v ?? "").trim();

function deriveCategories(ingredients: string[]) {
  return Object.entries(CATEGORY_RULES)
    .filter(([, list]) => list.some(item => ingredients.includes(item)))
    .map(([cat]) => cat);
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalize(raw: Drink): Drink {
  const title = cleanStr(raw.title);
  const description = cleanStr(raw.description);
  const recipe = cleanStr(raw.recipe);
  const comments = cleanStr(raw.comments);

  // NEW: detect ingredients by word-boundary matches anywhere in the text,
  // so "rye whiskey", "Rittenhouse rye", "whiskey (rye)" all count as "rye".
  const haystack = `${title}\n${description}\n${recipe}\n${comments}`.toLowerCase();

  const ingSet = new Set<string>();
  for (const ing of KNOWN_INGREDIENTS) {
    const re = new RegExp(`\\b${escapeRegExp(ing)}\\b`, "i");
    if (re.test(haystack)) ingSet.add(ing);
  }

  const ingredients = Array.from(ingSet);
  const categories = deriveCategories(ingredients);

  return {
    ...raw,
    title,
    description,
    recipe,
    comments,
    ingredients,
    categories,
  };
}



// Optional alias if any file still imports this name:
export { normalize as normalizeDrink };
