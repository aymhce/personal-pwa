const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/drive.appdata";
const APP_FILE_NAME = "daily-data.json";
const DAYS_SINCE_KEY = "days_since_date";
const APP_VERSION = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

const logEl = document.getElementById("log");
const clientIdEl = document.getElementById("clientId");
const titleEl = document.getElementById("title");
const contentEl = document.getElementById("content");

const saveConfigBtn = document.getElementById("saveConfig");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const saveBtn = document.getElementById("saveBtn");
const loadBtn = document.getElementById("loadBtn");

const homeView = document.getElementById("homeView");
const daysSinceView = document.getElementById("daysSinceView");
const techView = document.getElementById("techView");

const openDaysSinceBtn = document.getElementById("openDaysSinceBtn");
const openTechBtn = document.getElementById("openTechBtn");
const backHomeFromDaysBtn = document.getElementById("backHomeFromDaysBtn");
const backHomeFromTechBtn = document.getElementById("backHomeFromTechBtn");

const sinceDateEl = document.getElementById("sinceDate");
const saveDateBtn = document.getElementById("saveDateBtn");
const calcDaysBtn = document.getElementById("calcDaysBtn");
const daysResultEl = document.getElementById("daysResult");

let tokenClient = null;
let accessToken = null;

function normalizeError(err) {
  if (!err) return "Erreur inconnue";
  if (typeof err === "string") return err;

  if (err.result?.error) {
    const apiErr = err.result.error;
    const details = [];
    if (apiErr.code) details.push(`code=${apiErr.code}`);
    if (apiErr.status) details.push(`status=${apiErr.status}`);
    if (apiErr.message) details.push(`message=${apiErr.message}`);
    return details.length ? details.join(" | ") : JSON.stringify(apiErr);
  }

  if (err.error && typeof err.error === "string") return err.error;
  if (err.message) return err.message;

  try {
    return JSON.stringify(err);
  } catch {
    return "Erreur non sérialisable";
  }
}

function log(msg) {
  const safeMsg = msg == null ? "Message vide" : String(msg);
  const line = `[${new Date().toLocaleTimeString()}] ${safeMsg}`;
  logEl.textContent = `${line}\n${logEl.textContent}`.trim();
}

function loadClientId() {
  const saved = localStorage.getItem("google_client_id");
  if (saved && saved.trim()) {
    clientIdEl.value = saved.trim();
    return saved.trim();
  }
  return clientIdEl.value.trim();
}

function saveClientId() {
  const id = clientIdEl.value.trim();
  localStorage.setItem("google_client_id", id);
  log("Client ID sauvegardé en local.");
}

async function loadScript(src) {
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function initGoogleApis() {
  if (!window.gapi) {
    await loadScript("https://apis.google.com/js/api.js");
  }
  if (!window.google || !window.google.accounts) {
    await loadScript("https://accounts.google.com/gsi/client");
  }

  await new Promise((resolve) => gapi.load("client", resolve));
  await gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });

  const clientId = clientIdEl.value.trim();
  if (!clientId) {
    throw new Error("Client ID manquant.");
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: async (resp) => {
      if (resp.error) {
        log(`Erreur OAuth: ${normalizeError(resp)}`);
        return;
      }
      accessToken = resp.access_token;
      gapi.client.setToken({ access_token: accessToken });
      log("Connecté à Google Drive.");
      try {
        await syncDaysSinceFromDrive();
      } catch (e) {
        log(`Sync date (post-login) erreur: ${normalizeError(e)}`);
      }
    }
  });
}

function ensureAuth() {
  if (!tokenClient) throw new Error("Google API non initialisée.");
}

function requestLogin(prompt = "consent") {
  ensureAuth();
  tokenClient.requestAccessToken({ prompt });
}

function logout() {
  if (accessToken && window.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(accessToken);
  }
  accessToken = null;
  gapi.client.setToken(null);
  log("Déconnecté.");
}

function isAuthenticated() {
  return Boolean(accessToken);
}

function ensureDriveReady() {
  if (!window.gapi?.client?.drive) {
    throw new Error("API Drive non initialisée. Vérifie l'initialisation Google.");
  }
  if (!isAuthenticated()) {
    throw new Error("Utilisateur non authentifié Google.");
  }
}

async function findAppFile() {
  ensureDriveReady();
  const res = await gapi.client.drive.files.list({
    spaces: "appDataFolder",
    q: `name='${APP_FILE_NAME}' and trashed=false`,
    fields: "files(id,name)",
    pageSize: 1
  });
  return res.result.files?.[0] || null;
}

async function uploadAppData(jsonObject) {
  ensureDriveReady();
  const existing = await findAppFile();

  const metadata = existing
    ? {
        name: APP_FILE_NAME,
        mimeType: "application/json"
      }
    : {
        name: APP_FILE_NAME,
        parents: ["appDataFolder"],
        mimeType: "application/json"
      };

  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    "Content-Type: application/json\r\n\r\n" +
    JSON.stringify(jsonObject) +
    closeDelim;

  const path = existing ? `/upload/drive/v3/files/${existing.id}` : "/upload/drive/v3/files";
  const method = existing ? "PATCH" : "POST";

  await gapi.client.request({
    path,
    method,
    params: { uploadType: "multipart" },
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  log(existing ? "Fichier JSON mis à jour." : "Fichier JSON créé.");
}

async function downloadAppData() {
  ensureDriveReady();
  const existing = await findAppFile();
  if (!existing) return null;
  const res = await gapi.client.drive.files.get({
    fileId: existing.id,
    alt: "media"
  });
  return res.result;
}

async function saveData() {
  const key = titleEl.value.trim();
  const text = contentEl.value;
  if (!key) {
    log("Titre/clé requis.");
    return;
  }

  const current = (await downloadAppData()) || {};
  current[key] = {
    content: text,
    updatedAt: new Date().toISOString()
  };
  await uploadAppData(current);
  log(`Entrée "${key}" sauvegardée.`);
}

async function loadData() {
  const key = titleEl.value.trim();
  if (!key) {
    log("Titre/clé requis.");
    return;
  }

  const current = await downloadAppData();
  if (!current || !current[key]) {
    log(`Aucune donnée pour "${key}".`);
    return;
  }

  contentEl.value = current[key].content || "";
  log(`Entrée "${key}" chargée (maj: ${current[key].updatedAt || "n/a"}).`);
}

function showView(viewName) {
  homeView.classList.add("hidden");
  daysSinceView.classList.add("hidden");
  techView.classList.add("hidden");

  if (viewName === "home") homeView.classList.remove("hidden");
  if (viewName === "daysSince") daysSinceView.classList.remove("hidden");
  if (viewName === "tech") techView.classList.remove("hidden");
}

function formatDaysLabel(days) {
  return `${days} ${days > 1 ? "jours" : "jour"}`;
}

function calculateDaysSince(dateStr) {
  if (!dateStr) return null;
  const start = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((nowUtc - startUtc) / 86400000);
}

function renderDaysSince() {
  const dateStr = sinceDateEl.value;
  const days = calculateDaysSince(dateStr);
  if (days === null) {
    daysResultEl.textContent = "Date invalide";
    return;
  }
  if (days < 0) {
    daysResultEl.textContent = `La date est dans ${Math.abs(days)} ${Math.abs(days) > 1 ? "jours" : "jour"}`;
    return;
  }
  daysResultEl.textContent = formatDaysLabel(days);
}

function loadDaysSinceFromLocal() {
  const savedDate = localStorage.getItem(DAYS_SINCE_KEY);
  if (savedDate) {
    sinceDateEl.value = savedDate;
  } else {
    const today = new Date().toISOString().slice(0, 10);
    sinceDateEl.value = today;
  }
  renderDaysSince();
}

function saveDaysSinceToLocalOnly() {
  const v = sinceDateEl.value;
  if (!v) {
    log("Date requise pour la sous-app.");
    return false;
  }
  localStorage.setItem(DAYS_SINCE_KEY, v);
  renderDaysSince();
  return true;
}

async function saveDaysSince() {
  const ok = saveDaysSinceToLocalOnly();
  if (!ok) return;

  if (!isAuthenticated()) {
    log("Date sauvegardée en local (non connecté à Google).");
    return;
  }

  try {
    const current = (await downloadAppData()) || {};
    current[DAYS_SINCE_KEY] = {
      value: sinceDateEl.value,
      updatedAt: new Date().toISOString()
    };
    await uploadAppData(current);
    log("Date sauvegardée en local + Drive.");
  } catch (e) {
    log(`Sauvegarde date Drive erreur: ${normalizeError(e)}`);
  }
}

async function syncDaysSinceFromDrive() {
  if (!isAuthenticated()) return;

  const current = (await downloadAppData()) || {};
  const remote = current[DAYS_SINCE_KEY];

  if (remote && typeof remote.value === "string" && remote.value) {
    sinceDateEl.value = remote.value;
    localStorage.setItem(DAYS_SINCE_KEY, remote.value);
    renderDaysSince();
    log("Date synchronisée depuis Drive.");
    return;
  }

  const local = localStorage.getItem(DAYS_SINCE_KEY);
  if (local) {
    current[DAYS_SINCE_KEY] = {
      value: local,
      updatedAt: new Date().toISOString()
    };
    await uploadAppData(current);
    log("Aucune date distante: date locale poussée vers Drive.");
  }
}

async function bootstrap() {
  loadClientId();
  loadDaysSinceFromLocal();
  showView("home");

  saveConfigBtn.addEventListener("click", saveClientId);

  loginBtn.addEventListener("click", async () => {
    try {
      if (!tokenClient) await initGoogleApis();
      requestLogin("consent");
    } catch (e) {
      log(`Init/login erreur: ${normalizeError(e)}`);
    }
  });

  logoutBtn.addEventListener("click", () => {
    try {
      logout();
    } catch (e) {
      log(`Logout erreur: ${normalizeError(e)}`);
    }
  });

  saveBtn.addEventListener("click", async () => {
    try {
      await saveData();
    } catch (e) {
      log(`Sauvegarde erreur: ${normalizeError(e)}`);
    }
  });

  loadBtn.addEventListener("click", async () => {
    try {
      await loadData();
    } catch (e) {
      log(`Chargement erreur: ${normalizeError(e)}`);
    }
  });

  openDaysSinceBtn.addEventListener("click", () => showView("daysSince"));
  openTechBtn.addEventListener("click", () => showView("tech"));
  backHomeFromDaysBtn.addEventListener("click", () => showView("home"));
  backHomeFromTechBtn.addEventListener("click", () => showView("home"));

  saveDateBtn.addEventListener("click", async () => {
    await saveDaysSince();
  });
  calcDaysBtn.addEventListener("click", renderDaysSince);
  sinceDateEl.addEventListener("change", renderDaysSince);

  if ("serviceWorker" in navigator) {
    try {
      const swUrl = `./sw.js?v=${encodeURIComponent(APP_VERSION)}`;
      await navigator.serviceWorker.register(swUrl, { updateViaCache: "none" });
      await navigator.serviceWorker.ready;
      log(`Service worker enregistré (build ${APP_VERSION}).`);
    } catch (e) {
      log(`SW erreur: ${normalizeError(e)}`);
    }
  }

  try {
    await initGoogleApis();
    requestLogin("");
    log("Connexion Google automatique déclenchée.");
  } catch (e) {
    log(`Init auto Google erreur: ${normalizeError(e)}`);
  }
}

bootstrap();
