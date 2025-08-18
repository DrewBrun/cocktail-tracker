// src/components/AnyAllToggle.tsx
// Extra compact segmented control to switch between ANY and ALL ingredient matching.

type IngredientMode = "any" | "all";

type Props = {
  mode: IngredientMode;
  onChange: (m: IngredientMode) => void;
  className?: string;
};

export default function AnyAllToggle({ mode, onChange, className = "" }: Props) {
  return (
    <div
      className={`inline-flex rounded-md border overflow-hidden text-[10px] ${className}`}
      role="group"
      aria-label="Ingredient match mode"
    >
      <button
        type="button"
        onClick={() => onChange("any")}
        className={`px-1.5 py-0.5 ${mode === "any" ? "bg-blue-600 text-white" : "bg-white hover:bg-gray-50"}`}
        aria-pressed={mode === "any"}
      >
        Any
      </button>
      <button
        type="button"
        onClick={() => onChange("all")}
        className={`px-1.5 py-0.5 border-l ${mode === "all" ? "bg-blue-600 text-white" : "bg-white hover:bg-gray-50"}`}
        aria-pressed={mode === "all"}
      >
        All
      </button>
    </div>
  );
}
