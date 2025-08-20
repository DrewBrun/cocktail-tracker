// src/features/parties/usePartyAssignments.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db } from "../drinks/db";
import { fetchAllPartyDrinks } from "../drinks/dataSource";
import { addPartyAssignment, removePartyAssignment, setPartyAssignments } from "../data/writeApi";

export type PartyDrink = { partyId: string; drinkId: string; addedAt?: number; [k: string]: any };

type UsePartyAssignmentsState = {
  drinkIds: string[];                // list of ids/slugs assigned to this party
  add: (drinkId: string) => Promise<void>;
  remove: (drinkId: string) => Promise<void>;
  setMany: (ids: string[]) => Promise<void>;
  loading: boolean;
  errorMessage: string | null;
};

async function refreshAssignmentsFromRemote(): Promise<PartyDrink[]> {
  const remote = await fetchAllPartyDrinks();
  // Normalize: allow {partyDrinks:[...]}, {partyDrinkList:[...]}, or [...]
  const arr = Array.isArray(remote)
    ? remote
    : (remote as any)?.partyDrinks && Array.isArray((remote as any).partyDrinks)
    ? (remote as any).partyDrinks
    : (remote as any)?.partyDrinkList && Array.isArray((remote as any).partyDrinkList)
    ? (remote as any).partyDrinkList
    : [];
  const normalized = arr.map((r: any) => ({
    partyId: String(r.partyId ?? ""),
    drinkId: String(r.drinkId ?? ""),
    addedAt: Number.isFinite(r.addedAt) ? r.addedAt : Date.now(),
    ...r,
  })).filter((r: PartyDrink) => r.partyId && r.drinkId);

  await db.transaction("rw", db.partyDrinks, async () => {
    await db.partyDrinks.clear();
    await db.partyDrinks.bulkAdd(normalized);
  });
  return normalized;
}

export function usePartyAssignments(partyId?: string): UsePartyAssignmentsState {
  const [all, setAll] = useState<PartyDrink[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // initial load from Dexie
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await db.partyDrinks.toArray();
      if (!cancelled) setAll(rows);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const reload = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const fresh = await refreshAssignmentsFromRemote();
      setAll(fresh);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to refresh assignments");
    } finally {
      setLoading(false);
    }
  }, []);

  // remote refresh on mount
  useEffect(() => {
    reload();
    return () => abortRef.current?.abort();
  }, [reload]);

  // list of drinkIds for the chosen party
  const drinkIds = useMemo(
    () => (partyId ? all.filter((r) => r.partyId === partyId).map((r) => String(r.drinkId)) : []),
    [all, partyId]
  );

  const add = useCallback(async (drinkId: string) => {
    if (!partyId) return;
    await addPartyAssignment(partyId, String(drinkId));
    const fresh = await refreshAssignmentsFromRemote();
    setAll(fresh);
  }, [partyId]);

  const remove = useCallback(async (drinkId: string) => {
    if (!partyId) return;
    // If your Lambda supports op:"delete", this will remove. Otherwise, no-op.
    try {
      await removePartyAssignment(partyId, String(drinkId));
    } catch (e) {
      console.warn("removePartyAssignment not supported on backend yet; ignoring", e);
    }
    const fresh = await refreshAssignmentsFromRemote();
    setAll(fresh);
  }, [partyId]);

  const setMany = useCallback(async (ids: string[]) => {
    if (!partyId) return;
    try {
      await setPartyAssignments(partyId, ids.map(String));
    } catch (e) {
      // If backend doesn't support op:setMany yet, fallback to per-id adds (not removing extras)
      console.warn("setMany not supported; falling back to adds", e);
      for (const id of ids) await addPartyAssignment(partyId, String(id));
    }
    const fresh = await refreshAssignmentsFromRemote();
    setAll(fresh);
  }, [partyId]);

  return { drinkIds, add, remove, setMany, loading, errorMessage };
}
