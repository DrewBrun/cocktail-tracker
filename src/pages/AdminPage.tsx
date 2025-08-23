// src/pages/AdminPage.tsx
import { Link } from "react-router-dom";

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">Admin</h1>
        <p className="text-sm text-gray-400">quick links for editors & reports</p>
      </header>

      <nav className="grid gap-3">
        <Link to="/cheers42/new" className="rounded-2xl border px-4 py-3 hover:bg-gray-50">
          🥃 Drink Editor (new)
        </Link>
        <Link to="/cheers42/reports" className="rounded-2xl border px-4 py-3 hover:bg-gray-50">
          📊 Reports
        </Link>
<Link className="block px-4 py-3 hover:bg-gray-50" to="/parties">🎉 Parties</Link>
      
      </nav>
    </div>
  );
}
