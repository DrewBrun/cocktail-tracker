// src/features/drinks/db.ts
import Dexie from "dexie";
import type { Table } from "dexie";
import type { Drink as DrinkRaw } from "../../lib/types";

// ---- Party types ------------------------------------------------------------
export type PartyID = string;

export type Party = {
  id: PartyID;            // e.g. "4" from your TSV or a nanoid
  name: string;
  date?: string | null;   // "YYYY-MM-DD"
  tagline?: string | null;
  title?: string | null;  // ⬅️ was "notes"; now "title"
  slug?: string;          // normalized party name for remote compatibility
  createdAt: number;      // ms
  updatedAt: number;      // ms
};

export type PartyDrink = {
  partyId: PartyID;
  drinkId: string;        // your drink primary key (stringified)
  addedAt: number;        // ms
};

// ---- Drinks / Meta ----------------------------------------------------------
export interface Drink extends DrinkRaw {
  id?: number;            // Dexie PK (numeric) — other code uses Number(idOrSlug)
  slug: string;           // URL-friendly
  // NOTE: keep these optional; they’re also added by normalize()
  ingredients?: string[];
  categories?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Meta {
  key: string;
  value: any;
}

export class CocktailDB extends Dexie {
  drinks!: Table<Drink, number>;
  meta!: Table<Meta, string>;

  // Party tables
  parties!: Table<Party, string>;
  partyDrinks!: Table<PartyDrink, [string, string]>; // compound key [partyId+drinkId]

  constructor() {
    super("DrewsCocktailDB");

    // v1: existing schema (unchanged)
    this.version(1).stores({
      drinks: "++id, slug, title, *ingredients, *categories, updatedAt",
      meta: "&key",
    });

    // v2: add party tables (originally used 'notes' on rows, not indexed)
    this.version(2).stores({
      parties: "id, name, date, createdAt, updatedAt, tagline", // 'notes' wasn’t indexed
      partyDrinks: "[partyId+drinkId], partyId, drinkId, addedAt",
    });

    // v3: migrate notes -> title on party rows and index 'title' and 'slug'
    this.version(3).stores({
      drinks: "++id, slug, title, *ingredients, *categories, updatedAt",
      meta: "&key",
      parties: "id, name, date, createdAt, updatedAt, tagline, title, slug",
      partyDrinks: "[partyId+drinkId], partyId, drinkId, addedAt",
    }).upgrade(async (tx) => {
      const table = tx.table("parties");
      await table.toCollection().modify((row: any) => {
        if (row && row.notes && !row.title) {
          row.title = row.notes;
        }
        if (row && Object.prototype.hasOwnProperty.call(row, "notes")) {
          delete row.notes;
        }
        // Add slug if missing
        if (row && typeof row.name === "string" && !row.slug) {
          row.slug = (row.name ?? "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");
        }
      });
    });
  }
}

export const db = new CocktailDB();

// OPTIONAL: expose for console debugging/imports
if (typeof window !== "undefined") (window as any).db = db;


// ---- Import helpers for parties & partyDrinks -------------------------------
export async function importParties(parties: Party[]) {
  const now = Date.now();
  await db.transaction('rw', db.parties, async () => {
    for (const p of parties) {
      // ensure timestamps & slug
      const createdAt = p.createdAt ?? now;
      const updatedAt = p.updatedAt ?? now;
      const slug = p.slug ?? makeSlug(p.title ?? p.name);
      await db.parties.put({ ...p, createdAt, updatedAt, slug });
    }
  });
}

export async function importPartyDrinks(rows: { partyId: PartyID; drinkId: string }[]) {
  await db.transaction('rw', db.partyDrinks, async () => {
    for (const r of rows) {
      // prevent dupes
      const exists = await db.partyDrinks.where({ partyId: r.partyId, drinkId: r.drinkId }).first();
      if (!exists) await db.partyDrinks.add({ ...r, addedAt: Date.now() });
    }
  });
}


export function makeSlug(title?: string) {
  return (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
