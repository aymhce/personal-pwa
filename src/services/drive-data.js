import { log } from "../utils/logger.js";

const APP_FILE_NAME = "daily-data.json";
const DAYS_SINCE_KEY = "days_since_date";

function ensureDriveReady() {
  if (!window.gapi?.client?.drive) {
    throw new Error("API Drive non initialisée.");
  }
  const token = gapi.client.getToken?.();
  if (!token?.access_token) {
    throw new Error("Utilisateur non authentifié Google.");
  }
}

export async function initDriveDataService() {
  ensureDriveReady();
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

async function downloadAll() {
  ensureDriveReady();
  const existing = await findAppFile();
  if (!existing) return null;
  const res = await gapi.client.drive.files.get({
    fileId: existing.id,
    alt: "media"
  });
  return res.result;
}

async function uploadAll(jsonObject) {
  ensureDriveReady();
  const existing = await findAppFile();

  const metadata = existing
    ? { name: APP_FILE_NAME, mimeType: "application/json" }
    : { name: APP_FILE_NAME, parents: ["appDataFolder"], mimeType: "application/json" };

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

export async function saveGenericEntry(key, content) {
  const clean = key.trim();
  if (!clean) {
    log("Titre/clé requis.");
    return;
  }

  const current = (await downloadAll()) || {};
  current[clean] = {
    content,
    updatedAt: new Date().toISOString()
  };
  await uploadAll(current);
  log(`Entrée "${clean}" sauvegardée.`);
}

export async function loadGenericEntry(key) {
  const clean = key.trim();
  if (!clean) {
    log("Titre/clé requis.");
    return null;
  }
  const current = await downloadAll();
  if (!current || !current[clean]) return null;
  return current[clean];
}

export async function saveDaysSinceToDrive(dateValue) {
  const current = (await downloadAll()) || {};
  current[DAYS_SINCE_KEY] = {
    value: dateValue,
    updatedAt: new Date().toISOString()
  };
  await uploadAll(current);
}

export async function syncDaysSinceFromDrive(applyDate) {
  const current = (await downloadAll()) || {};
  const remote = current[DAYS_SINCE_KEY];
  if (remote?.value) {
    localStorage.setItem(DAYS_SINCE_KEY, remote.value);
    applyDate(remote.value);
    log("Date synchronisée depuis Drive.");
    return;
  }

  const local = localStorage.getItem(DAYS_SINCE_KEY);
  if (local) {
    current[DAYS_SINCE_KEY] = {
      value: local,
      updatedAt: new Date().toISOString()
    };
    await uploadAll(current);
    log("Aucune date distante: date locale poussée vers Drive.");
  }
}
