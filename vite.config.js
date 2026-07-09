import { defineConfig } from "vite";

const buildVersion = String(Date.now());

export default defineConfig({
  // Important pour GitHub Pages (user site ET project site)
  // et pour éviter les 404 + MIME text/html sur les modules.
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion)
  }
});
