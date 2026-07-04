let logEl = null;

export function initLogger(element) {
  logEl = element;
}

export function normalizeError(err) {
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

export function log(message) {
  const safe = message == null ? "Message vide" : String(message);
  const line = `[${new Date().toLocaleTimeString()}] ${safe}`;
  if (!logEl) {
    console.log(line);
    return;
  }
  logEl.textContent = `${line}\n${logEl.textContent}`.trim();
}
