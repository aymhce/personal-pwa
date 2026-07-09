import { defineConfig } from "vite";

const buildVersion = String(Date.now());

export default defineConfig({
  base: "/personal-pwa/",
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion)
  }
});
