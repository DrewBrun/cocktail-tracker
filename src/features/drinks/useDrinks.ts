// Cache-first + refresh from /drinks.json
import { useCallback, useEffect, useRef, useState } from "react";
import { db, type Drink, makeSlug } from "./db";
import type { Drink as DrinkRaw } from "../../lib/types";
import { normalize } from "../../lib/normalize";
import { fetchJson } from "../../lib/fetchJson";

export type UseDrinksState = {
  drinks: Drink[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

function baseUrl() {
  const base = (import.meta.env.VITE_DATA_BASE_URL as string | undefined) ?? "";
  return base.replace(/\/$/, "");
}

export function useDrinks(): UseDrinksState {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 1) Instant load from Dexie
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await db.drinks.toArray();
        if (!cancelled) setDrinks(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadRemote = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const url = `${baseUrl()}/drinks.json`;
      // Accept either: an array OR { drinks: [...] }
      //const raw = await fetchJson<any>(url, { signal: controller.signal, cache: "no-store" as RequestCache });
      const raw = await fetchJson<any>(url);
      const rawList: DrinkRaw[] = Array.isArray(raw) ? raw : (raw?.drinks ?? []);
      const now = Date.now();

      const normalized: Drink[] = rawList.map((d) => {
        const nd = normalize(d) as DrinkRaw & { title?: string; name?: string; ingredients?: string[]; categories?: string[] };
        const titleOrName = (nd as any).title ?? (nd as any).name ?? "";
        return {
          ...(nd as any),
          slug: makeSlug(titleOrName),
          createdAt: typeof (nd as any).createdAt === "number" ? (nd as any).createdAt : now,
          updatedAt: now,
        } as unknown as Drink;
      });

      await db.transaction("rw", db.drinks, db.meta, async () => {
        await db.drinks.clear();
        await db.drinks.bulkAdd(normalized);
        await db.meta.put({ key: "drinks_lastImportAt", value: now });
      });

      setDrinks(normalized);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e?.message ?? "Failed to load drinks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRemote();
    return () => abortRef.current?.abort();
  }, [loadRemote]);

  return { drinks, loading, error, reload: loadRemote };
}
