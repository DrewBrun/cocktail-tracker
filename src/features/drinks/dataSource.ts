// src/features/drinks/dataSource.ts
export type Drink = any;
export type Party = { id: string; name: string; date?: string | null; [k: string]: any };
export type PartyDrink = { partyId: string; drinkId: string; addedAt?: number; [k: string]: any };

function baseUrl() {
  const b = (import.meta.env.VITE_DATA_BASE_URL as string | undefined) ?? "";
  return b.replace(/\/$/, ""); // trim trailing slash
}

async function fetchRaw(path: string): Promise<any> {
  const base = `${baseUrl()}/${path}`;
  const makeURL = () => base + (base.includes("?") ? "&" : "?") + "_=" + Date.now();

  let lastErr: unknown = null;
  for (const delay of [0, 200, 500, 1000, 2000]) {
    if (delay) await new Promise(r => setTimeout(r, delay));
    try {
      const res = await fetch(makeURL(), { cache: "no-store" as RequestCache });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
      }
      return await res.json();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Failed to fetch");
}


export async function fetchAllDrinks(): Promise<Drink[]> {
  const raw = await fetchRaw("drinks.json");
  return Array.isArray(raw) ? raw : (raw?.drinks ?? []);
}

export async function fetchAllParties(): Promise<Party[]> {
  const raw = await fetchRaw("parties.json");
  return Array.isArray(raw) ? raw : (raw?.parties ?? []);
}

export async function fetchAllPartyDrinks(): Promise<PartyDrink[]> {
  const raw = await fetchRaw("partyDrinks.json");
  // accept either key
  return Array.isArray(raw) ? raw : (raw?.partyDrinks ?? raw?.partyDrinkList ?? []);
}
