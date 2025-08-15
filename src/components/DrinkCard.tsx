// src/components/DrinkCard.tsx
import type { Drink } from "../lib/types";

export default function DrinkCard({ d }: { d: Drink }) {
  return (
    <article className="rounded-2xl border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">{d.title}</h2>
        {d.selected && <span className="rounded-full border px-2 text-xs">★</span>}
      </div>
      {d.description && <p className="mt-2 text-sm text-gray-800">{d.description}</p>}
      {d.recipe && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-gray-700">Recipe</summary>
          <pre className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{d.recipe}</pre>
        </details>
      )}
      {d.comments && <p className="mt-2 text-xs text-gray-500">{d.comments}</p>}
    </article>
  );
}
