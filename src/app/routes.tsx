// src/app/routes.tsx
import { createHashRouter } from "react-router-dom";
import Layout from "./Layout";
import DrinkBrowsePage from "../pages/DrinkBrowsePage";
import DrinkEditorPage from "../features/drinks/editor/DrinkEditorPage";
import ImportPage from "../features/drinks/import/ImportPage";

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

      { path: "import", element: <ImportPage /> },
    ],
  },
]);
