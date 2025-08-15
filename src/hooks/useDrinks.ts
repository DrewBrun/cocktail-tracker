import { useEffect, useState } from "react";
import { fetchJSON } from "../lib/fetchJson";
import { normalizeDrink } from "../lib/normalize";
import type { Drink } from "../lib/types";

// Read from env, fall back to /cocktails/data
const DATA_BASE_URL =
  (import.meta as any).env?.VITE_DATA_BASE_URL || "/cocktails/data";

type Any = Record<string, any>;

export function useDrinks(dataBaseUrl = DATA_BASE_URL) {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const dj = await fetchJSON<any>(`${dataBaseUrl}/drinks.json`);
    const raw: Any[] =
      (Array.isArray(dj) && dj) ||
      (dj?.drinks && Array.isArray(dj.drinks) && dj.drinks) ||
      (dj?.Drinks && Array.isArray(dj.Drinks) && dj.Drinks) ||
      [];
    setDrinks(raw.map(normalizeDrink));
    setLoading(false);
  }

  useEffect(() => {
    document.title = "Cocktails";
    load().catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { drinks, loading, error, reload: load };
}
