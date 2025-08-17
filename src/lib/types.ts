// src/lib/types.ts

// Canonical app-wide shape for a drink record coming from JSON,
// plus optional fields the UI/DB may add.
export interface Drink {
  // JSON fields
  title: string;
  description?: string;
  recipe?: string;
  comments?: string;
  selected?: boolean;        // ★ favorites (present in your JSON)

  // Optional fields the app/DB can add
  id?: number;               // Dexie PK (added after import)
  ingredients?: string[];    // derived by normalize()
  categories?: string[];     // derived by normalize()
}
