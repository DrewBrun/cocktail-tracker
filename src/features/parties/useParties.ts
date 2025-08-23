// src/features/parties/useParties.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { db, type Party } from "../drinks/db";
import { fetchJson } from "../../lib/fetchJson";

export type UsePartiesState = {
  parties: Party[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

function baseUrl() {
  const base = (import.meta.env.VITE_DATA_BASE_URL as string | undefined) ?? "";
  return base.replace(/\/$/, "");
}

export function useParties(): UsePartiesState {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadRemote = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      // 1) cache-first
      const local = await db.parties.orderBy("createdAt").reverse().toArray();
      if (local.length) setParties(local);

      // 2) refresh from JSON
      const remote = await fetchJson<Party[] | { parties: Party[] }>(`${baseUrl()}/parties.json`);
const list: Party[] = Array.isArray(remote)
  ? remote
  : (remote && Array.isArray((remote as any).parties) ? (remote as any).parties : []);
  
      if (Array.isArray(list) && list.length) {
        await db.transaction('rw', db.parties, async () => {
          // upsert by id
          for (const p of list) await db.parties.put({
            ...p,
            createdAt: p.createdAt ?? Date.now(),
            updatedAt: p.updatedAt ?? Date.now(),
          });
        });
        setParties(await db.parties.orderBy("createdAt").reverse().toArray());
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message ?? "Failed to load parties");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRemote();
    return () => abortRef.current?.abort();
  }, [loadRemote]);

  return { parties, loading, error, reload: loadRemote };
}
