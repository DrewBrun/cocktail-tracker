// src/features/drinks/reports.ts
import { db } from "../drinks/db";
import type { Party, PartyDrink } from "../drinks/db";
import type { Drink } from "../drinks/db";

export type DateRange = { from?: number | null; to?: number | null };

function withinRange(ts: number, range: DateRange): boolean {
  if (!ts) return false;
  const { from, to } = range || {};
  if (from && ts < from) return false;
  if (to && ts > to) return false;
  return true;
}

export async function fetchPartyDrinksInRange(range: DateRange): Promise<PartyDrink[]> {
  // Use addedAt (ms) on PartyDrink; if missing, fall back to party.date
  const pds = await db.table<PartyDrink>("partyDrinks").toArray();

  // If some rows lack addedAt, try to infer from party.date
  const partiesById = new Map<string, Party>();
  return Promise.all(
    pds.map(async (pd) => {
      if (pd.addedAt) return pd;
      if (!partiesById.size) {
        const parties = await db.table<Party>("parties").toArray();
        parties.forEach(p => partiesById.set(p.id, p));
      }
      const party = partiesById.get(pd.partyId);
      const ts = party?.date ? Date.parse(party.date) : 0;
      return { ...pd, addedAt: ts || 0 };
    })
  ).then(all => all.filter(pd => withinRange(pd.addedAt || 0, range)));
}

export async function mostMadeDrinks(range: DateRange) {
  const [pds, drinks] = await Promise.all([
    fetchPartyDrinksInRange(range),
    db.table<Drink>("drinks").toArray()
  ]);
  const drinkByKey = new Map<string, Drink>();
  drinks.forEach(d => drinkByKey.set(String(d.id ?? d.slug), d));

  const counts = new Map<string, number>();
  for (const pd of pds) {
    const key = String(pd.drinkId);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

type TopRow = { key: string; count: number; name: string; slug: string };

const rows: TopRow[] = Array.from(counts, ([key, count]) => {
  // `get` returns Drink | undefined; `find` returns Drink | undefined
  const d = drinkByKey.get(key) ?? drinks.find(x => String(x.slug) === key);

  // Be defensive about fields, in case some rows don’t have `name`
  const name =
    (d as any)?.name ??
    (d as any)?.title ?? // if you use title in some records
    (d as any)?.slug ??
    key;

  const slug = (d as any)?.slug ?? String((d as any)?.id ?? key);

  return { key, count, name, slug };
}).sort((a, b) => b.count - a.count);

  return rows;
}

export async function ingredientUsage(range: DateRange) {
  const top = await mostMadeDrinks(range);
  const drinksBySlug = new Map<string, Drink>();
  const drinks = await db.table<Drink>("drinks").toArray();
  drinks.forEach(d => drinksBySlug.set(d.slug, d));

  const ingredientsCount = new Map<string, number>();

  for (const row of top) {
    const drink = drinksBySlug.get(row.slug);
    // Try a few common shapes: ingredients: string[] OR [{name}] OR strings in recipe lines
    const raw = (drink as any)?.ingredients ?? (drink as any)?.ingredientList ?? [];
    const names: string[] = Array.isArray(raw)
      ? raw.map((it: any) => (typeof it === "string" ? it : (it?.name ?? ""))).filter(Boolean)
      : [];
    for (const ing of names) {
      ingredientsCount.set(ing, (ingredientsCount.get(ing) || 0) + row.count);
    }
  }

  const rows = Array.from(ingredientsCount.entries())
    .map(([ingredient, count]) => ({ ingredient, count }))
    .sort((a, b) => b.count - a.count);

  return rows;
}

// date utilities
export function presetToRange(preset: "30" | "90" | "ytd" | "all"): DateRange {
  const now = Date.now();
  if (preset === "all") return { from: null, to: null };
  if (preset === "ytd") {
    const yStart = new Date(new Date().getFullYear(), 0, 1).getTime();
    return { from: yStart, to: now };
  }
  const days = preset === "30" ? 30 : 90;
  const from = now - days * 24 * 60 * 60 * 1000;
  return { from, to: now };
}
