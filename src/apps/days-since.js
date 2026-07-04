import { log } from "../utils/logger.js";

const DAYS_SINCE_KEY = "days_since_date";

let sinceDateEl = null;
let daysResultEl = null;
let onSaveCb = null;

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

export function initDaysSinceApp({
  sinceDateEl: dateInput,
  saveDateBtn,
  calcDaysBtn,
  daysResultEl: resultEl,
  onSave
}) {
  sinceDateEl = dateInput;
  daysResultEl = resultEl;
  onSaveCb = onSave;

  saveDateBtn.addEventListener("click", async () => {
    if (onSaveCb) {
      await onSaveCb(sinceDateEl.value);
    }
  });
  calcDaysBtn.addEventListener("click", renderDaysSince);
  sinceDateEl.addEventListener("change", renderDaysSince);

  return {
    setDate: (value) => {
      sinceDateEl.value = value;
    }
  };
}

export function loadDaysSinceFromLocal() {
  const savedDate = localStorage.getItem(DAYS_SINCE_KEY);
  if (savedDate) {
    sinceDateEl.value = savedDate;
  } else {
    sinceDateEl.value = new Date().toISOString().slice(0, 10);
  }
}

export function saveDaysSinceToLocalOnly(value) {
  if (!value) {
    log("Date requise pour la sous-app.");
    return false;
  }
  localStorage.setItem(DAYS_SINCE_KEY, value);
  return true;
}

export function renderDaysSince() {
  const dateStr = sinceDateEl.value;
  const days = calculateDaysSince(dateStr);

  if (days === null) {
    daysResultEl.textContent = "Date invalide";
    return;
  }
  if (days < 0) {
    const d = Math.abs(days);
    daysResultEl.textContent = `La date est dans ${d} ${d > 1 ? "jours" : "jour"}`;
    return;
  }
  daysResultEl.textContent = formatDaysLabel(days);
}
