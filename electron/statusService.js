const https = require("https");
const http = require("http");
const { getEndpoints } = require("./endpoints");
const { createCache } = require("./requestCache");

const REQUEST_TIMEOUT_MS = 8000;

// Court (4s) : assez pour absorber plusieurs composants qui interrogent le
// statut à quelques ms d'écart (App, LoginScreen, Settings, Discord Rich
// Presence montent/pollent tous indépendamment), sans jamais retarder une
// vraie information de plus de quelques secondes sur le polling normal.
// Les changements de maintenance/modules restent instantanés malgré ce
// cache : invalidateStatusCache() est appelée explicitement dès que le
// backend pousse l'événement Socket.IO correspondant (voir notifications.js).
const STATUS_CACHE_TTL_MS = 4000;
const CACHE_KEY = "status";
const statusCache = createCache();

function doFetchStatus(base) {
  return new Promise((resolve) => {
    const client = base.startsWith("https") ? https : http;
    const req = client.get(base, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}

/**
 * Interroge /launcher/status (via le cache, sauf { force: true }) pour
 * connaître l'état du service.
 *
 * En cas d'échec réseau, on considère délibérément qu'il n'y a PAS de
 * maintenance : un backend injoignable ne doit pas verrouiller un joueur
 * hors de son jeu déjà installé. La maintenance est une décision explicite
 * du serveur, pas un état par défaut.
 */
function fetchStatus({ force = false } = {}) {
  const base = getEndpoints().status;
  if (!base) return Promise.resolve(null);
  if (force) statusCache.invalidate(CACHE_KEY);
  return statusCache.cachedFetch(CACHE_KEY, STATUS_CACHE_TTL_MS, () => doFetchStatus(base));
}

/** A appeler dès qu'on sait que le statut a changé côté serveur (poussé par
 * Socket.IO) : la prochaine lecture ira forcément chercher la vraie valeur. */
function invalidateStatusCache() {
  statusCache.invalidate(CACHE_KEY);
}

/** Raccourci : renvoie l'objet maintenance normalisé, jamais null. */
async function getMaintenance(options) {
  const status = await fetchStatus(options);
  return {
    enabled: Boolean(status?.maintenance?.enabled),
    message: status?.maintenance?.message || "",
    allowDownloads: status?.maintenance?.allowDownloads !== false,
    reachable: status !== null,
  };
}

/**
 * Statut complet exposé au renderer : maintenance + modules activés.
 * Un module absent de la réponse (backend injoignable, ancien backend sans
 * cette route) est considéré comme désactivé — on n'affiche jamais une
 * fonctionnalité par erreur faute d'information.
 */
async function getServiceStatus(options) {
  const status = await fetchStatus(options);
  return {
    maintenance: {
      enabled: Boolean(status?.maintenance?.enabled),
      message: status?.maintenance?.message || "",
      allowDownloads: status?.maintenance?.allowDownloads !== false,
    },
    modules: status?.modules || {},
    reachable: status !== null,
  };
}

module.exports = { fetchStatus, getMaintenance, getServiceStatus, invalidateStatusCache };
