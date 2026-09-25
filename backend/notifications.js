const fs = require("fs");
const path = require("path");

const NOTIFICATIONS_PATH = path.join(__dirname, "notifications.json");
const MAX_HISTORY = 50; // au-delà, les plus anciennes sont oubliées (juste un historique, pas une base de données)

function loadNotifications() {
  if (!fs.existsSync(NOTIFICATIONS_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(NOTIFICATIONS_PATH, "utf-8"));
  } catch {
    console.warn("[backend-dev] notifications.json invalide, historique vide utilisé.");
    return [];
  }
}

/** Ajoute une notification en tête d'historique et la renvoie (avec id + date générés). */
function pushNotification({ type, title, message }) {
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    message: message || "",
    sentAt: new Date().toISOString(),
  };
  const history = [record, ...loadNotifications()].slice(0, MAX_HISTORY);
  fs.writeFileSync(NOTIFICATIONS_PATH, JSON.stringify(history, null, 2));
  return record;
}

module.exports = { loadNotifications, pushNotification };
