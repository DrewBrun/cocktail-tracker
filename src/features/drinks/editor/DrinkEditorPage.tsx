// src/features/drinks/editor/DrinkEditorPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { db, type Drink as DrinkRow, makeSlug } from "../db";
import type { Drink as DrinkRaw } from "../../../lib/types";
import { normalize } from "../../../lib/normalize";
import { upsertDrink } from "../../data/writeApi";
import { fetchAllDrinks } from "../dataSource";

// --- Types ---------------------------------------------------------------

type FormState = {
  title: string;
  description: string;
  recipe: string;
  comments: string;
  selected: boolean;
};

// --- Helpers -------------------------------------------------------------

const EMPTY: FormState = {
  title: "",
  description: "",
  recipe: "",
  comments: "",
  selected: false,
};

function toRaw(f: FormState): DrinkRaw {
  return {
    title: f.title.trim(),
    description: f.description.trim(),
    recipe: f.recipe.trim(),
    comments: f.comments.trim(),
    selected: f.selected,
  };
}

/** Load by numeric id OR slug; also handle empty DB on fresh loads. */
function useDrinkLoader(idOrSlug?: string) {
  const [initial, setInitial] = useState<FormState | null>(null);
  const [loading, setLoading] = useState<boolean>(!!idOrSlug);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (!idOrSlug) {
          setInitial(EMPTY);
          setLoading(false);
          return;
        }

        // If the DB hasn't been populated yet (fresh visit to deep link)
        const count = await db.drinks.count();
        if (cancel) return;
        if (count === 0) {
          setError(
            "No drinks in local database yet. Visit the home page once to initialize, then try again."
          );
          setLoading(false);
          return;
        }

        let row: DrinkRow | undefined;

        // Try numeric id
        if (/^\d+$/.test(idOrSlug)) {
          row = await db.drinks.get(Number(idOrSlug));
        }

        // Fallback to slug lookup
        if (!row) {
          row = await db.drinks.where("slug").equals(idOrSlug).first();
        }

        if (!row) {
          setError("Drink not found");
        } else {
          setInitial({
            title: row.title ?? "",
            description: row.description ?? "",
            recipe: row.recipe ?? "",
            comments: row.comments ?? "",
            selected: !!row.selected,
          });
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [idOrSlug]);

  return { initial, loading, error } as const;
}

// --- Component -----------------------------------------------------------

export default function DrinkEditorPage() {
  // IMPORTANT: route param must be :idOrSlug in routes.tsx
  const { idOrSlug } = useParams<{ idOrSlug: string }>();
  const isNew = !idOrSlug;
  const navigate = useNavigate();
  const { initial, loading, error } = useDrinkLoader(idOrSlug);

  const [form, setForm] = useState<FormState>(EMPTY);

  // Track the original slug to help server-side upsert distinguish update vs create
  const [originalSlug, setOriginalSlug] = useState<string | null>(null);

  // Index list for quick navigation (use slug for stable links)
  const [allDrinks, setAllDrinks] =
    useState<Array<Pick<DrinkRow, "id" | "title" | "slug">>>([]);
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);


  
  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);



  // Resolve and remember the current drink's stored slug (not just the URL fragment)
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!idOrSlug || isNew) {
        setOriginalSlug(null);
        return;
      }
      let row: DrinkRow | undefined;
      if (/^\d+$/.test(idOrSlug)) {
        row = await db.drinks.get(Number(idOrSlug));
      } else {
        row = await db.drinks.where("slug").equals(idOrSlug).first();
      }
      if (!cancel) setOriginalSlug(row?.slug ?? idOrSlug);
    })();
    return () => {
      cancel = true;
    };
  }, [idOrSlug, isNew]);

  // Load full index (id + title + slug) for quick links
  useEffect(() => {
    let cancel = false;
    (async () => {
      const rows = await db.drinks.orderBy("title").toArray();
      if (!cancel) {
        setAllDrinks(
          rows.map((r) => ({
            id: r.id,
            title: r.title ?? "",
            slug: r.slug ? String(r.slug) : "",
          }))
        );
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const normalized = useMemo(() => normalize(toRaw(form)), [form]);

  const canSave =
    form.title.trim().length > 0 && form.recipe.trim().length > 0 && !saving;

  // Pull fresh drinks from remote, normalize slugs, write to Dexie, refresh sidebar list
  async function resyncFromRemoteAndRefreshList() {
    const raw = await fetchAllDrinks();
    const arr = Array.isArray((raw as any)?.drinks) ? (raw as any).drinks : (raw as any);

    const normalizedList = (arr as any[]).map((d) => {
      const nd0 = normalize(d) as DrinkRaw & { ingredients?: string[]; categories?: string[] };
      return { ...nd0, slug: makeSlug(nd0.title) };
    });

    await db.transaction("rw", db.drinks, async () => {
      await db.drinks.clear();
      await db.drinks.bulkAdd(normalizedList as any);
    });

    const rows = await db.drinks.orderBy("title").toArray();
    setAllDrinks(
      rows.map((r) => ({
        id: r.id,
        title: r.title ?? "",
        slug: r.slug ? String(r.slug) : "",
      }))
    );
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);

    try {
      const now = Date.now();
      const nd = normalize(toRaw(form));
      const slug = makeSlug(nd.title);

      if (isNew) {
        // --- CREATE -------------------------------------------------------
        const row: DrinkRow = {
          ...(nd as DrinkRaw & { ingredients?: string[]; categories?: string[] }),
          slug,
          createdAt: now,
          updatedAt: now,
        };

        // 1) Local write (instant UX)
        await db.drinks.add(row);

        // 2) Remote write
        await upsertDrink({
          slug: row.slug ?? makeSlug(row.title),
          drink: row,
        });

        // 3) Re-sync local cache + refresh index
        await resyncFromRemoteAndRefreshList();

        // 4) Navigate to the new slug
        navigate(`/cheers42/${slug}`);
      } else {
        // --- UPDATE -------------------------------------------------------
        // Find existing row (we need createdAt & the real stored slug)
        let existingRow: DrinkRow | undefined;
        if (/^\d+$/.test(idOrSlug!)) {
          existingRow = await db.drinks.get(Number(idOrSlug));
        } else {
          existingRow = await db.drinks.where("slug").equals(idOrSlug!).first();
        }

        if (!existingRow || existingRow.id == null) {
          setSaveError("Could not update: drink not found.");
          setSaving(false);
          return;
        }

        const newSlug = slug;
        const payload: Partial<DrinkRow> = {
          ...(nd as DrinkRaw & { ingredients?: string[]; categories?: string[] }),
          slug: newSlug,
          createdAt: existingRow.createdAt ?? now, // preserve original createdAt
          updatedAt: now,
        };

        // 1) Local update
        await db.drinks.update(existingRow.id, payload);

        // 2) Remote write — include prevSlug if the slug changed
        const prevSlug =
          originalSlug && originalSlug !== newSlug ? originalSlug : undefined;
        await upsertDrink({
          ...(payload as any),
          prevSlug, // let Lambda treat this as a rename from prevSlug -> slug
        });

        // 3) Re-sync local cache + refresh index
        await resyncFromRemoteAndRefreshList();

        // 4) Navigate to (possibly changed) slug
        navigate(`/cheers42/${newSlug}`);
      }
    } catch (e: any) {
      setSaveError(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (isNew || !idOrSlug) return;
    if (!confirm("Delete this drink? This cannot be undone.")) return;

    if (/^\d+$/.test(idOrSlug)) {
      await db.drinks.delete(Number(idOrSlug));
    } else {
      const existing = await db.drinks.where("slug").equals(idOrSlug).first();
      if (existing?.id != null) await db.drinks.delete(existing.id);
    }
    navigate(-1);
  }

  if (loading) {
    return (
      <section className="rounded-2xl border bg-white p-4 text-sm text-gray-600">
        Loading…
      </section>
    );
  }
  if (error) {
    return (
      <section className="rounded-2xl border bg-white p-4 text-sm text-red-700">
        {error}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border bg-white p-4">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{isNew ? "New Drink" : "Edit Drink"}</h2>
        <div className="flex gap-2">
          {!isNew && (
            <button
              onClick={handleDelete}
              className="rounded-xl border px-3 py-2 text-sm text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`rounded-xl border px-3 py-2 text-sm ${
              canSave ? "hover:bg-gray-50" : "opacity-50"
            }`}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      {saveError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {saveError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-3">
          <FormRow label="Title" required>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g., Rye Old Fashioned"
              className="w-full rounded-xl border p-2"
            />
          </FormRow>
          <FormRow label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="A short blurb about the drink"
              rows={3}
              className="w-full resize-y rounded-xl border p-2"
            />
          </FormRow>
          <FormRow
            label="Recipe"
            required
            help="One ingredient per line is fine. Quantities optional."
          >
            <textarea
              value={form.recipe}
              onChange={(e) => setForm((f) => ({ ...f, recipe: e.target.value }))}
              placeholder={"2 oz rye whiskey\n0.25 oz rich demerara syrup\n2 dashes bitters\nOrange twist"}
              rows={8}
              className="w-full resize-y rounded-xl border p-2 font-mono text-sm"
            />
          </FormRow>
          <FormRow label="Comments">
            <textarea
              value={form.comments}
              onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
              placeholder="Notes, variations, glassware, etc."
              rows={3}
              className="w-full resize-y rounded-xl border p-2"
            />
          </FormRow>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.selected}
              onChange={(e) => setForm((f) => ({ ...f, selected: e.target.checked }))}
            />
            Favorite (★)
          </label>
        </div>

        <aside className="grid gap-3">
          <div className="rounded-xl border p-3">
            <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Preview</div>
            <div className="text-sm">
              <div className="font-medium">Slug</div>
              <div className="mb-2 text-gray-600">{makeSlug(form.title)}</div>
              <div className="font-medium">Detected Ingredients</div>
              <div className="text-gray-700">
                {(normalized.ingredients ?? []).join(", ") || "(none)"}
              </div>
            </div>
          </div>
          <div className="rounded-xl border p-3 text-xs text-gray-600">
            <div className="font-semibold">Tips</div>
            <ul className="ml-4 list-disc">
              <li>Use common names like “rye”, “gin”, “vermouth” so filters pick them up.</li>
              <li>Put one ingredient per line for readability (not required).</li>
              <li>Title and Recipe are required to save.</li>
            </ul>
          </div>
        </aside>
      </div>

      {/* Quick Edit Navigator */}
      <hr className="my-6" />
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">All Drinks</h3>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter list…"
            className="rounded-xl border px-2 py-1 text-sm"
          />
        </div>
        <div className="max-h-64 overflow-auto rounded-xl border">
          <ul className="divide-y text-sm">
            {allDrinks
              .filter((d) => (d.title ?? "").toLowerCase().includes(filter.toLowerCase()))
              .map((d) => (
                <li key={d.slug || String(d.id) || d.title}>
                  <Link
                    to={`/cheers42/${d.slug || String(d.id)}`} // prefer slug, fallback id
                    className="block px-3 py-2 hover:bg-gray-50"
                  >
                    {d.title || "(untitled)"}
                  </Link>
                </li>
              ))}
            {allDrinks.length === 0 && (
              <li className="px-3 py-2 text-gray-500">No drinks yet.</li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

// --- Small UI bits -------------------------------------------------------

function FormRow({
  label,
  required,
  help,
  children,
}: {
  label: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-2 text-sm">
        <span className="font-medium">{label}</span>
        {required && (
          <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">required</span>
        )}
        {help && <span className="text-xs text-gray-500">{help}</span>}
      </div>
      {children}
    </label>
  );
}
