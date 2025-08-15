import { useMemo, useState } from "react";
import "./index.css";
import { useDrinks } from "./hooks/useDrinks";
import Header from "./components/Header";
import SearchBar from "./components/SearchBar";
import DrinkGrid from "./components/DrinkGrid";
import Footer from "./components/Footer";

export default function App() {
  const [q, setQ] = useState("");
  const { drinks, loading, error, reload } = useDrinks(); // <- uses env or fallback

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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-gray-900">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Header />
          <div className="flex items-center gap-2">
            <SearchBar q={q} onChange={setQ} />
            <button className="rounded-2xl border px-3 py-2 text-sm" onClick={reload}>
              Reload
            </button>
          </div>
        </header>

        {loading && <div className="rounded-2xl border bg-white p-4 text-sm text-gray-600">Loading drinks…</div>}
        {error && <div className="rounded-2xl border bg-white p-4 text-sm text-red-700">Failed to load: {error}</div>}
        {!loading && !error && <DrinkGrid drinks={filtered} />}
        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-2xl border bg-white p-4 text-center text-gray-500">
            No drinks yet. Upload <code>drinks.json</code> to your S3 folder.
          </div>
        )}
        <Footer />
      </div>
    </div>
  );
}
