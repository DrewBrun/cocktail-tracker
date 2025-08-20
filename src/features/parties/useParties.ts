// src/features/parties/useParties.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { db, type Party as PartyRow } from "../drinks/db";
import { fetchAllParties } from "../drinks/dataSource";
import { upsertParty } from "../data/writeApi";

export type Party = PartyRow; // re-export the Dexie shape so consumers match PartyPicker

export type UsePartiesState = {
  parties: Party[];
  loading: boolean;
  errorMessage: string | null;
  reload: () => Promise<void>;
  createParty: (p: Omit<Party, "id" | "createdAt" | "updatedAt">) => Promise<Party>;
  updateParty: (id: string, p: Partial<Omit<Party, "id" | "createdAt">>) => Promise<void>;
  deleteParty: (id: string) => Promise<void>; // local-only until backend delete exists
};

function now() { return Date.now(); }

/** Normalize remote parties (array or {parties:[...]}) to PartyRow[] with timestamps */
function normalizeRemoteParties(remote: any): PartyRow[] {
  const list: any[] = Array.isArray(remote)
    ? remote
    : Array.isArray(remote?.parties)
    ? remote.parties
    : [];

  const t = now();
  return list
    .map((p) => ({
      id: String(p.id ?? ""),
      name: String(p.name ?? ""),
      date: p.date ?? null,
      tagline: p.tagline ?? null,
      title: p.title ?? null,
      createdAt: typeof p.createdAt === "number" ? p.createdAt : t,
      updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : t,
      // keep any passthrough fields if needed:
      ...p,
    }))
    .filter((p) => p.id && p.name);
}

/** Pull from remote JSON -> write to Dexie -> return list */
async function refreshPartiesFromRemote(): Promise<PartyRow[]> {
  const remote = await fetchAllParties();
  const normalized = normalizeRemoteParties(remote);
  await db.transaction("rw", db.parties, async () => {
    await db.parties.clear();
    await db.parties.bulkAdd(normalized); // matches PartyRow (has createdAt/updatedAt)
  });
  return normalized;
}

export function useParties(): UsePartiesState {
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fast load from Dexie
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await db.parties.orderBy("name").toArray();
        if (!cancelled) setParties(rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const reload = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const fresh = await refreshPartiesFromRemote();
      setParties(fresh);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to refresh parties");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial remote refresh on mount
  useEffect(() => {
    reload();
    return () => abortRef.current?.abort();
  }, [reload]);

  const createParty: UsePartiesState["createParty"] = useCallback(async (p) => {

    // POST to Lambda
    await upsertParty({
      name: p.name,
      date: p.date ?? null,
      tagline: p.tagline ?? null,
      title: p.title ?? null,
           });
    // Refresh from remote to get the canonical id/timestamps
    const fresh = await refreshPartiesFromRemote();
    setParties(fresh);
    // Best-effort: find by name+date match; otherwise return the last item
    const match =
      fresh.find((x) => x.name === p.name && (x.date ?? null) === (p.date ?? null)) ??
      fresh[fresh.length - 1];
    return match!;
  }, []);

  const updateParty: UsePartiesState["updateParty"] = useCallback(async (id, p) => {
    
    await upsertParty({
      id,
      ...(p.name !== undefined ? { name: p.name } : {}),
      ...(p.date !== undefined ? { date: p.date } : {}),
      ...(p.tagline !== undefined ? { tagline: p.tagline } : {}),
      ...(p.title !== undefined ? { title: p.title } : {}),
     
    } as any);
    const fresh = await refreshPartiesFromRemote();
    setParties(fresh);
  }, []);

  const deleteParty: UsePartiesState["deleteParty"] = useCallback(async (id) => {
    // Local delete only until backend supports delete
    await db.parties.delete(id);
    setParties(await db.parties.orderBy("name").toArray());
  }, []);

  return { parties, loading, errorMessage, reload, createParty, updateParty, deleteParty };
}
