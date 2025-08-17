// src/components/DrinkCard.tsx
import { useState, useCallback } from "react";
import type { Drink } from "../lib/types";

export default function DrinkCard({ d }: { d: Drink }) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  const onCardClick = useCallback((e: React.MouseEvent) => {
    // Don't toggle if the click is on an interactive element
    const target = e.target as HTMLElement;
    if (target.closest("a, button, summary, input, textarea, select, [data-no-toggle]")) return;
    toggle();
  }, [toggle]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  }, [toggle]);

  return (
    <article
      className="rounded-2xl border bg-white p-4 cursor-pointer hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={onCardClick}
      onKeyDown={onKeyDown}
      title="Click to expand recipe"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-semibold text-gray-900">{d.title}</h2>
        {d.selected && (
          <span aria-label="Selected drink" className="rounded-full border px-2 text-xs">
            ★
          </span>
        )}
      </div>

      {d.description && (
        <p className="mt-2 text-sm text-gray-800">{d.description}</p>
      )}

      {/* Keep native <details> but control it via state */}
      {d.recipe && (
        <details
          className="mt-2"
          open={open}
          onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer text-sm text-gray-700">
            Recipe
          </summary>
          <pre className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
            {d.recipe}
          </pre>
        </details>
      )}

      
    </article>
  );
}
