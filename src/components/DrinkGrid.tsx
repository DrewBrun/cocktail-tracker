import DrinkCard from "./DrinkCard";
import type { Drink } from "../lib/types";

export default function DrinkGrid({ drinks }: { drinks: Drink[] }) {
  return (
    <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {drinks.map((d, i) => (
        <DrinkCard key={(d.id ?? i) + (d.title || "")} d={d} />
      ))}
    </main>
  );
}
