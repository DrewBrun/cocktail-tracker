// src/features/drinks/useDrinks.ts
// Cache-first data hook backed by Dexie. Loads instantly from IndexedDB,
// refreshes from /drinks.json in the background, and exposes a reload().
const NORMALIZE_VERSION = 2; // bump whenever normalize.ts changes

import { useCallback, useEffect, useRef, useState } from "react";
import { db, type Drink, makeSlug } from "./db";
import type { Drink as DrinkRaw } from "../../lib/types";
import { normalize } from "../../lib/normalize";
import { fetchJson } from "../../lib/fetchJson"; // accepts alias to fetchJSON per our helper

// Remote JSON shape from drinks.json
interface RemoteData {
  version: number;
  exportedAt: string; // ISO string
  categories: unknown[];
  drinks: DrinkRaw[];
  parties: unknown[];
  partyDrinkList: unknown[];
}

export type UseDrinksState = {
  drinks: Drink[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

/**
 * Resolve the base URL for data. If VITE_DATA_BASE_URL isn't set,
 * assume same-origin root.
 */
function dataBaseUrl() {
  const base = import.meta.env.VITE_DATA_BASE_URL as string | undefined;
  return (base ?? "").replace(/\/$/, "");
}

export function useDrinks(): UseDrinksState {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 1) Read from Dexie immediately for fast first-paint
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await db.drinks.toArray();
        if (!cancelled) setDrinks(list);
      } catch (e) {
        console.error("Dexie read failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadRemote = useCallback(async () => {
    // cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const url = `${dataBaseUrl()}/drinks.json`;
      const remote = await fetchJson<RemoteData>(url);
      if (!remote) {
        throw new Error("No data returned from drinks.json");
      }

      // Compare exportedAt with meta to determine whether to overwrite DB
      const prevExport = await db.meta.get("exportedAt");
const prevNormVer = await db.meta.get("normalizeVersion");

const needsRebuild =
  !prevExport || prevExport.value !== remote.exportedAt ||
  !prevNormVer || prevNormVer.value !== NORMALIZE_VERSION;

if (needsRebuild) {
  const now = Date.now();
  const normalized: Drink[] = remote.drinks.map((d: DrinkRaw) => {
    const nd = normalize(d) as DrinkRaw & { ingredients?: string[]; categories?: string[] };
    return { ...nd, slug: makeSlug(nd.title), createdAt: now, updatedAt: now };
  });

  await db.transaction("rw", db.drinks, db.meta, async () => {
    await db.drinks.clear();
    await db.drinks.bulkAdd(normalized);
    await db.meta.put({ key: "exportedAt", value: remote.exportedAt });
    await db.meta.put({ key: "version", value: remote.version });
    await db.meta.put({ key: "lastImportAt", value: now });
    await db.meta.put({ key: "normalizeVersion", value: NORMALIZE_VERSION }); // <-- new
  });

  setDrinks(normalized);
} else {
  setDrinks(await db.drinks.toArray());
}

    } catch (e: any) {
      if (e?.name === "AbortError") return; // ignore aborted reloads
      console.error(e);
      setError(e?.message ?? "Failed to load drinks");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial remote refresh on mount
  useEffect(() => {
    loadRemote();
    return () => abortRef.current?.abort();
  }, [loadRemote]);

  return { drinks, loading, error, reload: loadRemote };
}
