import { useCallback, useEffect, useState } from "react";
import { db } from "../drinks/db";
import { upsertParty } from "../data/writeApi";
import type { Party, PartyID, PartyDrink } from "../drinks/db";

const DATA_BASE = import.meta.env.VITE_DATA_BASE_URL || "/data";

export function useParties() {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true); setErrorMessage(null);
    try {
      // Try remote JSON first
      const res = await fetch(`${DATA_BASE}/parties.json`, { cache: "no-cache" });
      let remote: Party[] = [];
      if (res.ok) {
        remote = await res.json();
      }
      // Only overwrite Dexie if remote has parties
      if (remote && remote.length > 0) {
        setParties(
          remote
            .filter(p => p && typeof p.name === "string" && p.name.trim() !== "")
            .sort((a,b)=>(a.name||"").localeCompare(b.name||""))
        );
        // hydrate Dexie (optional but keeps UI consistent)
        await db.transaction("rw", db.parties, async () => {
          await db.parties.clear();
          await db.parties.bulkPut(remote);
        });
      } else {
        // fallback to Dexie (dev/offline or remote empty)
        const local = await db.parties.toArray();
        local.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
        setParties(local);
      }
    } catch (e:any) {
      setErrorMessage(e.message || String(e));
      const local = await db.parties.toArray();
      local.sort((a,b)=>(a.name||"").localeCompare(b.name||""));
      setParties(local);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  // In Path A: treat writes as "local draft" only; you’ll export → upload to publish
  const createParty = useCallback(async (input: { name: string; date?: string|null; tagline?: string|null; title?: string|null }) => {
    const now = Date.now();
    // Generate slug from name (same as migration script)
    function toSlug(s: string) {
      return String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }
    const slug = toSlug(input.name.trim());
    const p: Party = {
      id: String(now), // use timestamp string for id
      name: input.name.trim(),
      date: input.date ?? null,
      tagline: input.tagline ?? null,
      title: input.title ?? null,
      slug,
      createdAt: now,
      updatedAt: now
    };
    await db.parties.put(p);
    // Try to publish to writer API if available; if it fails, keep local draft.
    try {
      await upsertParty({ id: p.id, party: p });
      // If writer succeeded, reload remote copy so UI reflects server canonical data.
      await reload();
    } catch (e: any) {
      console.warn("upsertParty failed; keeping local only", e?.message ?? e);
      // still reload to show local data
      await reload();
    }
    return p;
  }, [reload]);

  const updateParty = useCallback(async (id: PartyID, patch: Partial<Party>) => {
    await db.parties.update(id, { ...patch, updatedAt: Date.now() });
    // Attempt to push the updated party to the writer so remote stays in sync.
    try {
      const party = await db.parties.get(id as any);
      if (party) await upsertParty({ id, party });
    } catch (e: any) {
      console.warn("upsertParty (update) failed; local update only", e?.message ?? e);
    }
    await reload();
  }, [reload]);

  const deleteParty = useCallback(async (id: PartyID) => {
    await db.transaction("rw", db.parties, db.partyDrinks, async () => {
      await db.partyDrinks.where("partyId").equals(id).delete();
      await db.parties.delete(id);
    });
    await reload();
  }, [reload]);

  return { parties, loading, errorMessage, reload, createParty, updateParty, deleteParty };
}

export function usePartyAssignments(partyId?: PartyID) {
  const [drinkIds, setDrinkIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true); setErrorMessage(null);
    try {
      // Remote-first: load ALL links once, filter client-side
      const res = await fetch(`${DATA_BASE}/partyDrinks.json`, { cache: "no-cache" });
      if (res.ok) {
        const links: Array<{partyId: string; drinkId: string}> = await res.json();
        // hydrate Dexie table
        await db.transaction("rw", db.partyDrinks, async () => {
          await db.partyDrinks.clear();
          if (links.length) {
            const rows: PartyDrink[] = links.map(x => ({ partyId: x.partyId, drinkId: x.drinkId, addedAt: Date.now() }));
            await db.partyDrinks.bulkPut(rows);
          }
        });
      }
      // Now read from Dexie (fast path)
      if (partyId) {
        const rows = await db.partyDrinks.where("partyId").equals(partyId).toArray();
        setDrinkIds(rows.map(r => r.drinkId));
      } else {
        setDrinkIds([]);
      }
    } catch (e:any) {
      setErrorMessage(e.message || String(e));
      // pure local fallback
      if (partyId) {
        const rows = await db.partyDrinks.where("partyId").equals(partyId).toArray();
        setDrinkIds(rows.map(r => r.drinkId));
      } else {
        setDrinkIds([]);
      }
    } finally {
      setLoading(false);
    }
  }, [partyId]);

  useEffect(() => { void reload(); }, [reload]);

  // Local-only writes (draft); publish via Export page
  const add = useCallback(async (drinkId: string) => {
    if (!partyId) return;
    await db.partyDrinks.put({ partyId, drinkId, addedAt: Date.now() });
    await reload();
  }, [partyId, reload]);

  const remove = useCallback(async (drinkId: string) => {
    if (!partyId) return;
    await db.partyDrinks.where({ partyId, drinkId }).delete();
    await reload();
  }, [partyId, reload]);

  const setMany = useCallback(async (nextIds: string[]) => {
  if (!partyId) return;
  await db.transaction("rw", db.partyDrinks, async () => {
    await db.partyDrinks.where("partyId").equals(partyId).delete();
    if (nextIds.length) {
      const rows: PartyDrink[] = nextIds.map((id) => ({
        partyId,
        drinkId: id,
        addedAt: Date.now(),
      }));
      await db.partyDrinks.bulkPut(rows);
    }
  });
  await reload();
}, [partyId, reload]);


  return { loading, errorMessage, drinkIds, add, remove, setMany, reload };
}
