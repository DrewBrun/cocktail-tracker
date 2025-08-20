// src/features/data/writeApi.ts

// Admin-only write helpers for drinks, parties, and partyDrinks.
// Expects a Lambda Function URL that handles:
//   POST /drinks       -> upsert by slug
//   POST /parties      -> upsert by id
//   POST /partyDrinks  -> upsert an assignment (partyId, drinkId[, addedAt])
//
// Optional simple auth via x-admin-token.

const RAW_API = (import.meta.env.VITE_API_BASE_URL as string) || "";
const API_BASE = RAW_API.replace(/\/$/, ""); // strip trailing slash
const ADMIN = (import.meta.env.VITE_ADMIN_TOKEN as string) || "";

// Quick sanity check once at module load
if (!API_BASE) {
  // This won’t crash the app; just makes debugging easier in dev builds
  // (During prod builds, ensure the env is present.)
  // eslint-disable-next-line no-console
  console.warn("[writeApi] VITE_API_BASE_URL is not set – writes will fail.");
}

/** Fetch with optional timeout and clearer error paths */
async function postJSON<T>(path: string, payload: any, opts?: { timeoutMs?: number }): Promise<T> {
  if (!API_BASE) {
    throw new Error("Writer API not configured (VITE_API_BASE_URL is empty).");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 15000);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ADMIN ? { "x-admin-token": ADMIN } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    // Network/CORS/aborted
    const msg =
      err?.name === "AbortError"
        ? `POST ${path} aborted (timeout)`
        : `POST ${path} failed to fetch (network/CORS)`;
    throw new Error(msg);
  }

  clearTimeout(timeout);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    // Surface a concise server error
    throw new Error(`POST ${path} ${res.status} ${res.statusText}${txt ? ` — ${txt}` : ""}`);
  }

  // If Lambda returns empty body on success for some op, tolerate it
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

/** Upsert a drink (creates or updates by slug) */
export function upsertDrink(drink: any) {
  return postJSON<{ ok: boolean; slug?: string; count: number }>("/drinks", drink);
}

/** Upsert a party (creates or updates by id) */
export function upsertParty(party: {
  id?: string;
  name: string;
  date?: string | null;
  tagline?: string | null;
  title?: string | null;
}) {
  return postJSON<{ ok: boolean; count: number }>("/parties", party);
}

/** Add (or upsert) a single party assignment */
export function addPartyAssignment(partyId: string, drinkId: string, addedAt?: number) {
  return postJSON<{ ok: boolean; count: number }>("/partyDrinks", {
    partyId,
    drinkId,
    ...(addedAt ? { addedAt } : {}),
  });
}

/** Replace the full assignment set for a party (if backend supports op:\"setMany\") */
export function setPartyAssignments(partyId: string, drinkIds: string[]) {
  return postJSON<{ ok: boolean; count: number }>("/partyDrinks", {
    op: "setMany",
    partyId,
    drinkIds,
  });
}

/** Remove an assignment (if backend supports op:\"delete\") */
export function removePartyAssignment(partyId: string, drinkId: string) {
  return postJSON<{ ok: boolean }>("/partyDrinks", {
    op: "delete",
    partyId,
    drinkId,
  });
}

/** Optional: quick connectivity check you can call from Admin page */
export async function pingWriter(): Promise<{ ok: boolean; base: string }> {
  if (!API_BASE) throw new Error("Writer API base not set");
  // No actual endpoint call—just HEAD the function root to ensure CORS/network is okay
  const res = await fetch(API_BASE, { method: "HEAD" }).catch(() => null);
  if (!res) throw new Error("Failed to reach writer (network/CORS)");
  return { ok: res.ok, base: API_BASE };
}
