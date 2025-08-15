import { useEffect, useMemo, useState } from "react";
import "./index.css";

const DATA_BASE_URL = "/cocktails/data";

export type Drink = {
  id?: number;
  title: string;
  description?: string;
  recipe?: string;
  comments?: string;
  selected?: boolean;
  categoryId?: number | null;
};

// ---------- super-robust normalizer ----------
type Any = Record<string, any>;

const canon = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, ""); // drop spaces/_/punct

const flattenOneLevel = (r: Any): Any => {
  // If shape is {Something: {...}} with only 1 key, unwrap it
  const keys = Object.keys(r || {});
  if (keys.length === 1 && typeof r[keys[0]] === "object" && r[keys[0]] !== null) {
    return r[keys[0]];
  }
  return r;
};

const indexKeys = (r: Any) => {
  const idx: Record<string, string> = {};
  for (const k of Object.keys(r || {})) idx[canon(k)] = k;
  return idx;
};

const pick = (r: Any, idx: Record<string,string>, candidates: string[]) => {
  for (const c of candidates) {
    const ck = canon(c);
    if (idx[ck] !== undefined) {
      const v = r[idx[ck]];
      if (v !== undefined && v !== null && String(v).length) return v;
    }
  }
  return undefined;
};

const toBool = (v: any) =>
  v === true ||
  v === 1 ||
  v === -1 ||
  String(v).trim().toLowerCase() === "yes" ||
  String(v).trim().toLowerCase() === "true";

const normalizeDrink = (raw: Any): Drink => {
  let r = flattenOneLevel(raw);
  const idx = indexKeys(r);

  const id = Number(pick(r, idx, ["id", "ID", "DrinkID", "Pk", "Key"]));
  const title = pick(r, idx, ["title", "Title", "name", "Name", "drink", "Drink"]);
  const description = pick(r, idx, ["description", "Description", "summary", "Summary", "notes", "Notes"]);
  const recipe = pick(r, idx, ["recipe", "Recipe", "instructions", "Instructions", "method", "Method", "directions"]);
  const comments = pick(r, idx, ["comments", "Comments", "note", "Note"]);
  const selected = pick(r, idx, ["selected", "Selected", "isSelected", "IsSelected"]);
  const categoryId = pick(r, idx, ["categoryId", "CategoryId", "CategoryID", "category", "Category"]);

  const d: Drink = {
    ...(Number.isFinite(id) ? { id } : {}),
    title: (title ?? "").toString().trim() || "Untitled",
    description: description ? String(description) : undefined,
    recipe: recipe ? String(recipe) : undefined,
    comments: comments ? String(comments) : undefined,
    selected: selected !== undefined ? toBool(selected) : undefined,
    categoryId: categoryId !== undefined && categoryId !== "" ? Number(categoryId) : undefined,
  };
  return d;
};

// ---------- fetch helper ----------
async function fetchJSON<T = any>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    console.error("Failed to fetch", path, e);
    return null;
  }
}

export default function App() {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [q, setQ] = useState("");
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Cocktails";
    (async () => {
      const dj = await fetchJSON<any>(`${DATA_BASE_URL}/drinks.json`);
      const raw: Any[] =
        (Array.isArray(dj) && dj) ||
        (dj?.drinks && Array.isArray(dj.drinks) && dj.drinks) ||
        (dj?.Drinks && Array.isArray(dj.Drinks) && dj.Drinks) ||
        [];

      // Debug: show what keys we saw on first few records if ?debug=1
      const urlParams = new URLSearchParams(location.search);
      if (urlParams.get("debug") === "1") {
        const sample = raw.slice(0, 3).map((r) => Object.keys(flattenOneLevel(r)));
        setDebugInfo(`Sample keys from data: \n${sample.map((a,i)=>`#${i+1}: ${a.join(", ")}`).join("\n")}`);
      }

      setDrinks(raw.map(normalizeDrink));
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return drinks
      .filter(
        (d) =>
          !s ||
          d.title?.toLowerCase().includes(s) ||
          d.description?.toLowerCase().includes(s) ||
          d.recipe?.toLowerCase().includes(s) ||
          d.comments?.toLowerCase().includes(s)
      )
      .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  }, [drinks, q]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Drew&apos;s Cocktail List</h1>
            <p className="text-sm text-gray-600">Cheers Genitals!</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              placeholder="Search drinks…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="rounded-2xl border p-2"
            />
          </div>
        </header>

        {debugInfo && (
          <pre className="rounded-xl border bg-white p-3 text-xs whitespace-pre-wrap">
            {debugInfo}
          </pre>
        )}

        <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d, i) => (
            <article key={(d.id ?? i) + (d.title || "")} className="rounded-2xl border bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{d.title}</h2>
                </div>
                {d.selected && <span className="rounded-full border px-2 text-xs">★</span>}
              </div>
              {d.description && <p className="mt-2 text-sm">{d.description}</p>}
              {d.recipe && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-sm text-gray-600">Recipe</summary>
                  <pre className="mt-1 whitespace-pre-wrap text-sm">{d.recipe}</pre>
                </details>
              )}
              {d.comments && <p className="mt-2 text-xs text-gray-500">{d.comments}</p>}
            </article>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-2xl border bg-white p-4 text-center text-gray-500">
              No drinks yet. Upload drinks.json to your S3 folder.
            </div>
          )}
        </main>

        <footer className="text-xs text-gray-500">bluetap.com/cocktails</footer>
      </div>
    </div>
  );
}
