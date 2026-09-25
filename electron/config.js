const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const DEFAULT_CONFIG_PATH = path.join(__dirname, "config.default.json");

function deepMerge(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override || {})) {
    if (
      override[key] &&
      typeof override[key] === "object" &&
      !Array.isArray(override[key]) &&
      typeof base[key] === "object"
    ) {
      result[key] = deepMerge(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

function loadConfig() {
  const defaults = JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, "utf-8"));

  // Build packagé : pas de fichier externe, la config vient de l'exécutable
  // (electron/config.default.json, embarqué dans l'asar au build).
  if (app.isPackaged) {
    return { config: defaults, path: DEFAULT_CONFIG_PATH, external: false };
  }

  // Dev : config.json éditable à la racine du projet, pour pointer vers le
  // backend local lancé par `npm run dev` sans toucher au code.
  const devConfigPath = path.join(__dirname, "..", "config.json");
  if (!fs.existsSync(devConfigPath)) {
    fs.writeFileSync(devConfigPath, JSON.stringify(defaults, null, 2));
  }

  let userConfig = {};
  try {
    userConfig = JSON.parse(fs.readFileSync(devConfigPath, "utf-8"));
  } catch {
    console.warn(`config.json invalide (${devConfigPath}), valeurs par défaut utilisées.`);
  }

  return { config: deepMerge(defaults, userConfig), path: devConfigPath, external: true };
}

let cached = null;

/** Recharge la config depuis le disque (utile en dev après édition manuelle). */
function reloadConfig() {
  cached = loadConfig();
  return cached;
}

function getConfig() {
  if (!cached) cached = loadConfig();
  return cached.config;
}

function getConfigPath() {
  if (!cached) cached = loadConfig();
  return cached.path;
}

/** true en dev (config.json externe modifiable), false en build (config figée dans l'exe). */
function isConfigExternal() {
  if (!cached) cached = loadConfig();
  return cached.external;
}

module.exports = { getConfig, getConfigPath, reloadConfig, isConfigExternal };
