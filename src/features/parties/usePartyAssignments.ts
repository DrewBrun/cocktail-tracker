// src/features/parties/usePartyAssignments.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { db, type PartyID } from "../drinks/db";
import { fetchJson } from "../../lib/fetchJson";

export type PartyDrink = { partyId: PartyID; drinkId: string; addedAt?: number };

export function usePartyAssignments(partyId?: PartyID) {
  const [rows, setRows] = useState<PartyDrink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const base = ((import.meta as any).env.VITE_DATA_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

  const loadRemote = useCallback(async () => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(null);
    try {
      // 1) cache-first
      if (partyId) {
        const local = await db.partyDrinks.where("partyId").equals(partyId).toArray();
        if (local.length) setRows(local);
      }

      // 2) refresh from JSON
      const remote = await fetchJson<PartyDrink[] | { partyDrinks: PartyDrink[] }>(`${base}/partyDrinks.json`);
const list: PartyDrink[] = Array.isArray(remote)
  ? remote
  : (remote && Array.isArray((remote as any).partyDrinks) ? (remote as any).partyDrinks : []);
      if (Array.isArray(list)) {
        await db.transaction('rw', db.partyDrinks, async () => {
          // naive sync: ensure all listed rows exist locally
          for (const r of list) {
            const exists = await db.partyDrinks.where({ partyId: r.partyId, drinkId: r.drinkId }).first();
            if (!exists) await db.partyDrinks.add({ ...r, addedAt: r.addedAt ?? Date.now() });
          }
        });
        if (partyId) {
          setRows(await db.partyDrinks.where("partyId").equals(partyId).toArray());
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(e?.message ?? "Failed to load party assignments");
    } finally {
      setLoading(false);
    }
  }, [partyId, base]);

  useEffect(() => {
    loadRemote();
    return () => abortRef.current?.abort();
  }, [loadRemote]);

  return { assignments: rows, loading, error, reload: loadRemote };
}
