type Props = {
  q: string;
  onChange: (v: string) => void;
};

export default function SearchBar({ q, onChange }: Props) {
  return (
    <input
      placeholder="Search drinks…"
      value={q}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-2xl border p-2"
    />
  );
}
