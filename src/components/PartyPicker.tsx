import { useMemo } from "react";
import type { Party } from "../features/drinks/db";

type Props = {
  parties: Party[];
  value?: string;
  onChange: (id?: string) => void;
  compact?: boolean;
};

export default function PartyPicker({ parties, value, onChange, compact }: Props) {
  const sorted = useMemo(
    () => [...parties].sort((a, b) => a.name.localeCompare(b.name)),
    [parties]
  );

  return (
    <div className={compact ? "text-xs" : "text-sm"}>
      <label className="mr-2">Party:</label>
      <select
        className="border rounded-md px-2 py-1"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">— select a party —</option>
        {sorted.map(p => (
          <option key={p.id} value={p.id}>
            {p.name}{p.date ? ` (${p.date})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

