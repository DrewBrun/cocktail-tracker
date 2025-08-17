// src/features/drinks/filters/useFiltersOpen.tsx
// Controls the visibility of the FiltersBar.
// Goals:
//  - Hidden by default on first load (no URL/localStorage signal)
//  - Persist user choice in localStorage
//  - Allow optional URL override via ?filters=1 (open) or ?filters=0 (closed)
//  - Keep URL tidy: remove the param when state === default (closed)

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

// Change the version suffix if you ever want to reset everyone back to default.
const KEY = "filtersOpen_v3"; // v3 ensures default = hidden after deploy

function readUrlOpen(sp: URLSearchParams): boolean | null {
  if (!sp.has("filters")) return null; // no URL directive
  const v = sp.get("filters");
  return v === "1" ? true : v === "0" ? false : null;
}

function readInitial(sp: URLSearchParams): boolean {
  // URL override has top priority
  const urlOpen = readUrlOpen(sp);
  if (urlOpen !== null) return urlOpen;

  // Then check saved state
  const saved = localStorage.getItem(KEY);
  if (saved === "1") return true;
  if (saved === "0") return false;

  // Default: hidden (closed)
  return false;
}

export function useFiltersOpen() {
  const [sp, setSp] = useSearchParams();

  // Initialize once from URL -> localStorage -> default(false)
  const [open, setOpen] = useState<boolean>(() => readInitial(sp));

  // If a URL override is present, apply it immediately
  const urlOverride = useMemo(() => readUrlOpen(sp), [sp]);
  const effectiveOpen = urlOverride ?? open;

  // Persist state so the user's choice survives reloads
  useEffect(() => {
    localStorage.setItem(KEY, effectiveOpen ? "1" : "0");
  }, [effectiveOpen]);

  // Setter: update both state and URL
  const setOpenAll = (next: boolean) => {
    const n = new URLSearchParams(sp);

    if (next === false) {
      // Default is closed → keep URL clean
      n.delete("filters");
    } else {
      n.set("filters", "1");
    }

    setSp(n, { replace: true });
    setOpen(next);
  };

  return [effectiveOpen, setOpenAll] as const;
}
