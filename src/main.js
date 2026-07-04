import { initLogger, log, normalizeError } from "./utils/logger.js";
import { initRouter, showView } from "./utils/router.js";
import { initGoogleAuth } from "./services/auth.js";
import { registerServiceWorker } from "./services/sw-register.js";
import {
  initDriveDataService,
  saveGenericEntry,
  loadGenericEntry,
  saveDaysSinceToDrive,
  syncDaysSinceFromDrive
} from "./services/drive-data.js";
import {
  initDaysSinceApp,
  loadDaysSinceFromLocal,
  renderDaysSince,
  saveDaysSinceToLocalOnly
} from "./apps/days-since.js";
import { initTechApp } from "./apps/tech.js";

const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

let auth = null;
let driveReady = false;

function isDriveReady() {
  return driveReady;
}

async function loadTemplate(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Impossible de charger le template: ${path} (${res.status})`);
  }
  return await res.text();
}

async function mountTemplates() {
  const root = document.getElementById("app-root");
  const [home, days, tech] = await Promise.all([
    loadTemplate("./src/templates/home.html"),
    loadTemplate("./src/templates/days-since.html"),
    loadTemplate("./src/templates/tech.html")
  ]);
  root.innerHTML = `${home}\n${days}\n${tech}`;
}

async function bootstrap() {
  await mountTemplates();

  initLogger(document.getElementById("log"));

  const clientIdEl = document.getElementById("clientId");
  const saveConfigBtn = document.getElementById("saveConfig");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const titleEl = document.getElementById("title");
  const contentEl = document.getElementById("content");
  const saveBtn = document.getElementById("saveBtn");
  const loadBtn = document.getElementById("loadBtn");

  const openDaysSinceBtn = document.getElementById("openDaysSinceBtn");
  const openTechBtn = document.getElementById("openTechBtn");
  const backHomeFromDaysBtn = document.getElementById("backHomeFromDaysBtn");
  const backHomeFromTechBtn = document.getElementById("backHomeFromTechBtn");

  initRouter({
    home: document.getElementById("homeView"),
    daysSince: document.getElementById("daysSinceView"),
    tech: document.getElementById("techView")
  });
  showView("home");

  const daysSince = initDaysSinceApp({
    sinceDateEl: document.getElementById("sinceDate"),
    saveDateBtn: document.getElementById("saveDateBtn"),
    calcDaysBtn: document.getElementById("calcDaysBtn"),
    daysResultEl: document.getElementById("daysResult"),
    onSave: async (dateValue) => {
      const ok = saveDaysSinceToLocalOnly(dateValue);
      if (!ok) return;
      if (!isDriveReady()) {
        log("Date sauvegardée en local (Drive non prêt).");
        return;
      }
      try {
        await saveDaysSinceToDrive(dateValue);
        log("Date sauvegardée en local + Drive.");
      } catch (e) {
        log(`Sauvegarde date Drive erreur: ${normalizeError(e)}`);
      }
    }
  });

  initTechApp({
    clientIdEl,
    saveConfigBtn,
    loginBtn,
    logoutBtn,
    titleEl,
    contentEl,
    saveBtn,
    loadBtn,
    onSaveConfig: () => {
      const id = clientIdEl.value.trim();
      localStorage.setItem("google_client_id", id);
      log("Client ID sauvegardé en local.");
    },
    onLogin: async () => {
      try {
        await auth.loginInteractive();
      } catch (e) {
        log(`Init/login erreur: ${normalizeError(e)}`);
      }
    },
    onLogout: async () => {
      try {
        await auth.logout();
        driveReady = false;
      } catch (e) {
        log(`Logout erreur: ${normalizeError(e)}`);
      }
    },
    onSaveData: async () => {
      try {
        await saveGenericEntry(titleEl.value, contentEl.value);
      } catch (e) {
        log(`Sauvegarde erreur: ${normalizeError(e)}`);
      }
    },
    onLoadData: async () => {
      try {
        const val = await loadGenericEntry(titleEl.value);
        if (!val) {
          log(`Aucune donnée pour "${titleEl.value.trim()}".`);
          return;
        }
        contentEl.value = val.content || "";
        log(`Entrée "${titleEl.value.trim()}" chargée (maj: ${val.updatedAt || "n/a"}).`);
      } catch (e) {
        log(`Chargement erreur: ${normalizeError(e)}`);
      }
    }
  });

  openDaysSinceBtn.addEventListener("click", () => showView("daysSince"));
  openTechBtn.addEventListener("click", () => showView("tech"));
  backHomeFromDaysBtn.addEventListener("click", () => showView("home"));
  backHomeFromTechBtn.addEventListener("click", () => showView("home"));

  loadDaysSinceFromLocal();
  renderDaysSince();

  const savedClientId = localStorage.getItem("google_client_id");
  if (savedClientId && savedClientId.trim()) {
    clientIdEl.value = savedClientId.trim();
  }

  await registerServiceWorker(APP_VERSION);

  auth = initGoogleAuth({
    clientIdProvider: () => clientIdEl.value.trim(),
    onToken: async () => {
      try {
        await initDriveDataService();
        driveReady = true;
        await syncDaysSinceFromDrive((remoteDate) => {
          daysSince.setDate(remoteDate);
          renderDaysSince();
        });
      } catch (e) {
        driveReady = false;
        log(`Init Drive/sync erreur: ${normalizeError(e)}`);
      }
    }
  });

  try {
    await auth.init();
    await auth.loginSilent();
    log("Connexion Google automatique déclenchée.");
  } catch (e) {
    log(`Connexion auto non dispo: ${normalizeError(e)} (action manuelle possible).`);
  }
}

bootstrap().catch((e) => {
  console.error(e);
});
