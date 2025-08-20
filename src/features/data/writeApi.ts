// src/features/data/writeApi.ts

// Admin-only write helpers for drinks, parties, and partyDrinks.
// Expects a Lambda Function URL that handles:
//   POST /drinks       -> upsert by slug
//   POST /parties      -> upsert by id
//   POST /partyDrinks  -> upsert an assignment (partyId, drinkId[, addedAt])
//
// Optional simple auth via x-admin-token.

const RAW_API = (import.meta.env.VITE_API_BASE_URL as string) || "";
export const API_BASE = RAW_API.replace(/\/$/, ""); // strip trailing slash
export const ADMIN = (import.meta.env.VITE_ADMIN_TOKEN as string) || "";

// Instead of throwing at import time, lazily verify when a write is attempted.
function requireConfigured() {
  if (!API_BASE) {
    throw new Error(
      "Writer API not configured (set VITE_API_BASE_URL in your .env / build env)."
    );
  }
}

async function postJSON<T>(path: string, payload: unknown): Promise<T> {
  requireConfigured();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ADMIN ? { "x-admin-token": ADMIN } : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Writer API error ${res.status}: ${res.statusText}${text ? `\n${text}` : ""}`
    );
  }
  // If your Lambda returns no body, change to: return {} as T;
  return res.json() as Promise<T>;
}
// Accept both shapes:
//   A) { slug?, prevSlug?, drink: {...} }
//   B) { title?, name?, slug?, prevSlug?, ...other fields }
export type UpsertDrinkArg =
  | { slug?: string; prevSlug?: string; drink: Record<string, unknown> }
  | (Record<string, unknown> & {
      title?: string;
      name?: string;
      slug?: string;
      prevSlug?: string;
    });

export async function upsertDrink(arg: UpsertDrinkArg) {
  // Normalize to a flat payload for the Lambda
  const payload =
    "drink" in arg
      ? {
          ...(arg.drink as Record<string, unknown>),
          ...(arg.slug ? { slug: arg.slug } : {}),
          ...(arg.prevSlug ? { prevSlug: arg.prevSlug } : {}),
        }
      : (arg as Record<string, unknown>);

  // The writer accepts either name or title (name takes precedence).
  const nameOrTitle =
    (payload["name"] as string | undefined) ||
    (payload["title"] as string | undefined);

  if (!nameOrTitle || String(nameOrTitle).trim() === "") {
    throw new Error("title (or name) required");
  }

  return postJSON<{ ok: true }>("/drinks", payload);
}


export type UpsertPartyInput = { id: string; party: unknown };
export async function upsertParty(input: UpsertPartyInput) {
  return postJSON<{ ok: true }>("/parties", input);
}

export type UpsertPartyDrinkInput = {
  partyId: string;
  drinkId: string;
  addedAt?: number;
};
export async function upsertPartyDrink(input: UpsertPartyDrinkInput) {
  return postJSON<{ ok: true }>("/partyDrinks", input);
}

export async function deletePartyDrink(partyId: string, drinkId: string) {
  return postJSON<{ ok: true }>("/partyDrinks", {
    op: "delete",
    partyId,
    drinkId,
  });
}
// --- Back-compat wrappers for existing hooks --------------------------------

// Add a single drink to a party
export async function addPartyAssignment(
  partyId: string,
  drinkId: string,
  addedAt?: number
) {
  return upsertPartyDrink({ partyId, drinkId, addedAt });
}

// Remove a single drink from a party
export async function removePartyAssignment(partyId: string, drinkId: string) {
  return deletePartyDrink(partyId, drinkId);
}

// Replace all assignments for a party
// This assumes your Lambda supports a bulk "setAll" operation.
// If not, we can swap this to do a fetch-then-diff client-side.
export async function setPartyAssignments(partyId: string, drinkIds: string[]) {
  return postJSON<{ ok: true }>("/partyDrinks", {
    op: "setAll",
    partyId,
    drinkIds,
  });
}

/** Optional: quick connectivity check you can call from an Admin page.
 * Uses OPTIONS instead of HEAD to avoid 405s on Lambda Function URLs.
 */
export async function pingWriter(): Promise<{ ok: boolean; base: string }> {
  requireConfigured();
  const res = await fetch(API_BASE, { method: "OPTIONS" }).catch(() => null);
  if (!res) throw new Error("Failed to reach writer (network/CORS)");
  return { ok: !!res.ok, base: API_BASE };
}
