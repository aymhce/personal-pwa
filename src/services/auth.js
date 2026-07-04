import { log, normalizeError } from "../utils/logger.js";

const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/drive.appdata";

let tokenClient = null;
let accessToken = null;
let onTokenCb = null;
let clientIdProvider = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export function initGoogleAuth({ clientIdProvider: provider, onToken }) {
  clientIdProvider = provider;
  onTokenCb = onToken;

  return {
    init,
    loginSilent,
    loginInteractive,
    logout,
    getAccessToken: () => accessToken
  };
}

async function init() {
  if (!window.gapi) {
    await loadScript("https://apis.google.com/js/api.js");
  }
  if (!window.google?.accounts) {
    await loadScript("https://accounts.google.com/gsi/client");
  }

  await new Promise((resolve) => gapi.load("client", resolve));
  await gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });

  const clientId = clientIdProvider?.();
  if (!clientId) throw new Error("Client ID manquant.");

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: async (resp) => {
      if (resp?.error) {
        log(`Erreur OAuth: ${normalizeError(resp)}`);
        return;
      }

      accessToken = resp.access_token;
      gapi.client.setToken({ access_token: accessToken });
      log("Connecté à Google Drive.");

      try {
        if (onTokenCb) await onTokenCb();
      } catch (e) {
        log(`Post-login erreur: ${normalizeError(e)}`);
      }
    }
  });
}

function ensureTokenClient() {
  if (!tokenClient) throw new Error("Google API non initialisée.");
}

function requestAccessToken(prompt) {
  ensureTokenClient();

  return new Promise((resolve, reject) => {
    const previousCallback = tokenClient.callback;

    tokenClient.callback = async (resp) => {
      tokenClient.callback = previousCallback;

      if (resp?.error) {
        reject(resp);
        return;
      }

      accessToken = resp.access_token;
      gapi.client.setToken({ access_token: accessToken });

      log("Connecté à Google Drive.");
      try {
        if (onTokenCb) await onTokenCb();
      } catch (e) {
        log(`Post-login erreur: ${normalizeError(e)}`);
      }

      resolve(resp);
    };

    try {
      tokenClient.requestAccessToken({ prompt });
    } catch (e) {
      tokenClient.callback = previousCallback;
      reject(e);
    }
  });
}

async function loginSilent() {
  await requestAccessToken("");
}

async function loginInteractive() {
  await requestAccessToken("consent");
}

async function logout() {
  if (accessToken && window.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(accessToken);
  }
  accessToken = null;
  gapi.client.setToken(null);
  log("Déconnecté.");
}
