import { defineConfig } from "vite";

const buildVersion = String(Date.now());

// Nom du repo GitHub pour Pages : https://<user>.github.io/<repo>/
const repoName = "aymhce.github.io";

export default defineConfig(({ command }) => ({
  // En dev local, base relative pratique.
  // En build GitHub Pages, on force la base absolue du repo.
  base: command === "build" ? `/${repoName}/` : "./",
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion)
  }
}));
