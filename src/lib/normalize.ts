import type { Drink } from "./types";

type Any = Record<string, any>;

const canon = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");
const toBool = (v: any) =>
  v === true ||
  v === 1 ||
  v === -1 ||
  String(v).trim().toLowerCase() === "yes" ||
  String(v).trim().toLowerCase() === "true";

const flattenOneLevel = (r: Any) => {
  const ks = Object.keys(r || {});
  return ks.length === 1 && typeof r[ks[0]] === "object" ? r[ks[0]] : r;
};

const pick = (r: Any, idx: Record<string,string>, names: string[]) => {
  for (const n of names) {
    const ck = canon(n);
    const orig = idx[ck];
    if (orig != null) {
      const v = r[orig];
      if (v !== undefined && v !== null && String(v).length) return v;
    }
  }
  return undefined;
};

export function normalizeDrink(raw: Any): Drink {
  const r = flattenOneLevel(raw);
  const idx: Record<string,string> = {};
  Object.keys(r || {}).forEach(k => { idx[canon(k)] = k; });

  const id = Number(pick(r, idx, ["id","ID","DrinkID","Pk","Key"]));
  const title = pick(r, idx, ["title","Title","name","Name","drink","Drink"]);
  const description = pick(r, idx, ["description","Description","summary","Summary","notes","Notes"]);
  const recipe = pick(r, idx, ["recipe","Recipe","instructions","Instructions","method","Method","directions"]);
  const comments = pick(r, idx, ["comments","Comments","note","Note"]);
  const selected = pick(r, idx, ["selected","Selected","isSelected","IsSelected"]);
  const categoryId = pick(r, idx, ["categoryId","CategoryId","CategoryID","category","Category"]);

  return {
    ...(Number.isFinite(id) ? { id } : {}),
    title: (title ?? "").toString().trim() || "Untitled",
    description: description ? String(description) : undefined,
    recipe: recipe ? String(recipe) : undefined,
    comments: comments ? String(comments) : undefined,
    selected: selected !== undefined ? toBool(selected) : undefined,
    categoryId: categoryId !== undefined && categoryId !== "" ? Number(categoryId) : undefined,
  };
}
