// src/features/drinks/db.ts
import Dexie from "dexie";
import type { Table } from "dexie";
import type { Drink as DrinkRaw } from "../../lib/types";

export interface Drink extends DrinkRaw {
  id?: number;            // Dexie PK
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

  constructor() {
    super("cocktails");
    this.version(1).stores({
      drinks: "++id, slug, title, *ingredients, *categories, updatedAt",
      meta: "&key",
    });
  }
}

export const db = new CocktailDB();

export function makeSlug(title?: string) {
  return (title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
