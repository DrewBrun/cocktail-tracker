// src/app/routes.tsx
import { createHashRouter } from "react-router-dom";
import Layout from "./Layout";
import DrinkBrowsePage from "../pages/DrinkBrowsePage";
import DrinkEditorPage from "../features/drinks/editor/DrinkEditorPage";
import ImportPage from "../features/drinks/import/ImportPage";
import PartyAssignPage from "../pages/PartyAssignPage";

// ⬇️ add these
import ReportsPage from "../pages/ReportsPage";
import AdminPage from "../pages/AdminPage";

export const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <DrinkBrowsePage /> },

      // create (must be before the :idOrSlug matcher)
      { path: "cheers42/new", element: <DrinkEditorPage /> },

      // edit by numeric id OR slug
      { path: "cheers42/:idOrSlug", element: <DrinkEditorPage /> },

      { path: "cheers42/parties/assign", element: <PartyAssignPage /> },

      // reports (public route, but don't link it if you want it "quiet")
      { path: "cheers42/reports", element: <ReportsPage /> },

      // 🔐 hidden admin page (only reachable if you know the URL; protect inside AdminPage)
      { path: "cheers42/admin", element: <AdminPage /> },

      { path: "cheers42/import", element: <ImportPage /> },
    ],
  },
]);
