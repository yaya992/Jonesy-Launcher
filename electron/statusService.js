const https = require("https");
const http = require("http");
const { getEndpoints } = require("./endpoints");

const REQUEST_TIMEOUT_MS = 8000;

/**
 * Interroge /launcher/status pour connaître l'état du service.
 *
 * En cas d'échec réseau, on considère délibérément qu'il n'y a PAS de
 * maintenance : un backend injoignable ne doit pas verrouiller un joueur
 * hors de son jeu déjà installé. La maintenance est une décision explicite
 * du serveur, pas un état par défaut.
 */
function fetchStatus() {
  const base = getEndpoints().status;
  if (!base) return Promise.resolve(null);

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

/** Raccourci : renvoie l'objet maintenance normalisé, jamais null. */
async function getMaintenance() {
  const status = await fetchStatus();
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
async function getServiceStatus() {
  const status = await fetchStatus();
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

module.exports = { fetchStatus, getMaintenance, getServiceStatus };
