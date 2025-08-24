import { useCallback, useEffect, useState } from "react";
import { db } from "../drinks/db";
import type { Party } from "../drinks/db";
import { fetchJson } from "../../lib/fetchJson";
import { makeSlug } from "../drinks/db";

export type UsePartiesState = {
  parties: Party[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  forceReload: () => Promise<void>; // clears Dexie and cache-busts
};

function baseUrl() {
  const base = (import.meta.env.VITE_DATA_BASE_URL as string | undefined) ?? "";
  return base.replace(/\/$/, "");
}
function bust(u: string) {
  return u + (u.includes("?") ? "&" : "?") + "ts=" + Date.now();
}

export function useParties(): UsePartiesState {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  //const abortRef = useRef<AbortController | null>(null);

  const importRemote = useCallback(async (clearFirst: boolean) => {
    setError(null);
    // 1) cache-first (show something fast)
    const local = await db.parties.orderBy("createdAt").reverse().toArray();
    if (local.length && !clearFirst) setParties(local);

    // 2) fetch fresh JSON (cache-busted)
    const remote = await fetchJson<Party[] | { parties: Party[] }>(bust(`${baseUrl()}/parties.json`));
    const list: Party[] = Array.isArray(remote)
      ? remote
      : (remote && Array.isArray((remote as any).parties) ? (remote as any).parties : []);

    if (Array.isArray(list)) {
      await db.transaction("rw", db.parties, async () => {
        if (clearFirst) await db.parties.clear();
        for (const p of list) {
          await db.parties.put({
            ...p,
            slug: p.slug ?? makeSlug(p.title ?? p.name),
            createdAt: p.createdAt ?? Date.now(),
            updatedAt: p.updatedAt ?? Date.now(),
          });
        }
      });
    }
    setParties(await db.parties.orderBy("createdAt").reverse().toArray());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { await importRemote(false); } catch (e: any) { setError(e?.message ?? "Failed to load"); }
    finally { setLoading(false); }
  }, [importRemote]);

  const forceReload = useCallback(async () => {
    setLoading(true);
    try { await importRemote(true); } catch (e: any) { setError(e?.message ?? "Failed to force reload"); }
    finally { setLoading(false); }
  }, [importRemote]);

  useEffect(() => { load(); }, [load]);

  return { parties, loading, error, reload: load, forceReload };
}
