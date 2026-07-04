import { log, normalizeError } from "../utils/logger.js";

export async function registerServiceWorker(appVersion) {
  if (!("serviceWorker" in navigator)) return;

  try {
    const swUrl = `./sw.js?v=${encodeURIComponent(appVersion)}`;
    const reg = await navigator.serviceWorker.register(swUrl, { updateViaCache: "none" });
    await navigator.serviceWorker.ready;

    if (reg.waiting) {
      reg.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          log("Nouvelle version détectée, rechargement…");
          window.location.reload();
        }
      });
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      log("Service worker mis à jour.");
    });

    log(`Service worker enregistré (build ${appVersion}).`);
  } catch (e) {
    log(`SW erreur: ${normalizeError(e)}`);
  }
}
