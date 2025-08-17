// src/app/Layout.tsx
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-100">
      <main className="mx-auto max-w-4xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
