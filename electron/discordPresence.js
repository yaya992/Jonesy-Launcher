// electron/discordPresence.js
//
// Module "Discord Rich Presence" : affiche l'activité du joueur sur son
// profil Discord ("Dans le launcher" / "En jeu" + temps écoulé).
//
// Tout se passe en local : le launcher parle à l'application Discord de la
// machine via son canal IPC (pas de token, pas de compte à lier). Si Discord
// n'est pas ouvert, on réessaie discrètement en arrière-plan — jamais
// d'erreur visible pour le joueur.
//
// La config (Application ID, textes, bouton) vient du backend, dans
// /launcher/status → modules.discordRpc (voir backend/module-catalog.js),
// relue toutes les minutes et à chaque événement Socket.IO "modules".
//
// Ce fichier ne dépend pas d'`electron` (tout est injecté via `init`) pour
// rester testable en Node pur.

const RPC = require("discord-rpc");

const POLL_INTERVAL_MS = 60_000;
const RETRY_DELAY_MS = 15_000;

let opts = null;
let client = null;
let connectedClientId = null;
let ready = false;
let cfg = null; // config du module quand il est actif pour ce joueur, sinon null
let mode = "idle"; // "idle" (dans le launcher) | "playing"
let modeSince = Date.now();
let retryTimer = null;
let pollTimer = null;

/** Discord refuse les textes de moins de 2 caractères et de plus de 128. */
function clean(value, max = 128) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length >= 2 ? text.slice(0, max) : undefined;
}

function buildButtons() {
  const label = clean(cfg.buttonLabel, 32);
  const url = typeof cfg.buttonUrl === "string" ? cfg.buttonUrl.trim() : "";
  if (!label || !/^https?:\/\//i.test(url) || url.length > 512) return undefined;
  return [{ label, url }];
}

function buildActivity() {
  const playing = mode === "playing";
  const activity = {
    details: clean(cfg.details) || clean(opts.getAppName?.()),
    state: clean(playing ? cfg.statePlaying : cfg.stateIdle),
    startTimestamp: new Date(modeSince),
    largeImageKey: clean(cfg.largeImageKey, 256),
    buttons: buildButtons(),
    instance: false,
  };
  // discord-rpc sérialise tel quel : on retire les champs vides plutôt que
  // d'envoyer undefined/"" que Discord pourrait rejeter.
  return Object.fromEntries(Object.entries(activity).filter(([, v]) => v !== undefined));
}

function pushActivity() {
  if (!client || !ready || !cfg) return;
  client.setActivity(buildActivity()).catch(() => {});
}

function safeDestroy(c) {
  try {
    Promise.resolve(c.destroy()).catch(() => {});
  } catch {
    /* déjà fermé */
  }
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  if (!cfg) return;
  retryTimer = setTimeout(refresh, RETRY_DELAY_MS);
}

function connect() {
  if (client || !cfg) return;

  const clientId = cfg.clientId;
  const c = new RPC.Client({ transport: "ipc" });
  client = c;
  connectedClientId = clientId;
  ready = false;

  c.on("ready", () => {
    if (client !== c) return;
    ready = true;
    pushActivity();
  });

  // Discord fermé en cours de route : on repart en mode "réessai".
  c.on("disconnected", () => {
    if (client !== c) return;
    client = null;
    connectedClientId = null;
    ready = false;
    safeDestroy(c);
    scheduleRetry();
  });

  // Discord pas lancé (ou pas de canal IPC) : login échoue, on réessaie.
  c.login({ clientId }).catch(() => {
    if (client === c) {
      client = null;
      connectedClientId = null;
      ready = false;
    }
    safeDestroy(c);
    scheduleRetry();
  });
}

function teardown() {
  clearTimeout(retryTimer);
  if (!client) return;
  const c = client;
  client = null;
  connectedClientId = null;
  ready = false;
  // On efface la présence proprement avant de fermer, pour qu'elle disparaisse
  // tout de suite du profil au lieu d'attendre le timeout côté Discord.
  Promise.resolve(c.clearActivity())
    .catch(() => {})
    .then(() => safeDestroy(c));
}

/**
 * Relit la config du module et aligne la connexion dessus : (dé)connexion si
 * le module ou la préférence du joueur change, mise à jour du texte sinon.
 */
async function refresh() {
  if (!opts) return;

  const status = await opts.getStatus().catch(() => null);
  // Backend injoignable : on garde l'état actuel plutôt que de faire
  // clignoter la présence à chaque coupure réseau passagère.
  if (!status || status.reachable === false) return;

  const mod = status.modules?.discordRpc;
  const clientId = String(mod?.clientId ?? "").trim();
  const wanted = opts.isEnabledByUser() && mod?.enabled === true && /^\d{15,21}$/.test(clientId);

  if (!wanted) {
    cfg = null;
    teardown();
    return;
  }

  cfg = { ...mod, clientId };
  if (client && connectedClientId !== clientId) teardown();

  if (!client) connect();
  else pushActivity();
}

/**
 * @param {object} options
 * @param {() => Promise<{reachable:boolean, modules:object}>} options.getStatus
 * @param {() => boolean} options.isEnabledByUser  préférence du joueur (Settings)
 * @param {() => string} [options.getAppName]      repli pour la ligne principale
 */
function initDiscordPresence(options) {
  opts = options;
  refresh();
  pollTimer = setInterval(refresh, POLL_INTERVAL_MS);
}

function setPlaying() {
  mode = "playing";
  modeSince = Date.now();
  pushActivity();
}

function setIdle() {
  mode = "idle";
  modeSince = Date.now();
  pushActivity();
}

function destroyDiscordPresence() {
  clearInterval(pollTimer);
  cfg = null;
  teardown();
  opts = null;
}

module.exports = {
  initDiscordPresence,
  refreshDiscordPresence: refresh,
  setPlaying,
  setIdle,
  destroyDiscordPresence,
};
