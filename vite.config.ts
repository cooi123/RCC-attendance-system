import { copyFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vite";

/** GitHub project pages: https://<user>.github.io/<repo>/ — Vite assets must use this base. */
function pagesBase(): string {
  const fromEnv = process.env.VITE_BASE_PATH?.trim();
  if (fromEnv) {
    const withSlash = fromEnv.startsWith("/") ? fromEnv : `/${fromEnv}`;
    return withSlash.endsWith("/") ? withSlash : `${withSlash}/`;
  }
  if (process.env.GITHUB_ACTIONS === "true") {
    const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
    // user.github.io / org.github.io repos are served at site root, not /repo-name/
    if (repo && !/\.github\.io$/i.test(repo)) return `/${repo}/`;
  }
  return "/";
}

const base = pagesBase();
const rootPath = base === "/" ? "" : base.replace(/\/$/, "");
const iconSrc = rootPath ? `${rootPath}/favicon.svg` : "/favicon.svg";
const navigateFallback = rootPath ? `${rootPath}/index.html` : "/index.html";

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons.svg"],
      manifest: {
        name: "Attendance",
        short_name: "Attendance",
        description: "Check in and manage attendance",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "portrait",
        scope: base,
        start_url: base,
        icons: [
          {
            src: iconSrc,
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        navigateFallback,
        globPatterns: ["**/*.{js,css,html,ico,svg,woff2}"],
        mode: "development",
      },
    }),
    {
      name: "github-pages-spa-404",
      closeBundle() {
        const dist = path.resolve(__dirname, "dist");
        copyFileSync(path.join(dist, "index.html"), path.join(dist, "404.html"));
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
  },
  preview: {
    host: true,
  },
});
