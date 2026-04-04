import { ConvexProvider, ConvexReactClient } from "convex/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  console.warn(
    "VITE_CONVEX_URL is not set. Add it to .env.local (run `npx convex dev`).",
  );
}

const convex = new ConvexReactClient(convexUrl ?? "");

/** Match Vite `base` (GitHub project pages use /repo-name/). */
function routerBasename(): string {
  const raw = import.meta.env.BASE_URL;
  const trimmed = raw.endsWith("/") ? raw.slice(0, -1) : raw;
  return trimmed === "" ? "/" : trimmed;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <BrowserRouter basename={routerBasename()}>
        <App />
      </BrowserRouter>
    </ConvexProvider>
  </StrictMode>,
);
