const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "game_config.json");

const DEFAULT_CONFIG = {
  server: {
    port: 4000,
    adminPassword: "admin",
  },
  maintenance: {
    enabled: false,
    message: "Maintenance en cours, le jeu sera de retour très vite.",
    // Laisser les téléchargements ouverts pendant une maintenance permet aux
    // joueurs de préparer la mise à jour avant la réouverture.
    allowDownloads: true,
  },
  // Fonctionnalités annexes activables/désactivables sans toucher au code du
  // launcher, chacune avec ses propres paramètres. Le catalogue des modules
  // disponibles (nom, description, schéma des paramètres) vit dans
  // module-catalog.js — ceci ne stocke que l'état choisi par l'admin.
  modules: {
    news: { enabled: true, maxPosts: 5 },
    discord: { enabled: false, inviteUrl: "" },
    faq: { enabled: false },
    socials: { enabled: false },
    serverStatus: { enabled: false },
    twitch: { enabled: false, channelUrl: "" },
    credits: { enabled: false },
  },
  games: [
    {
      id: "season-main",
      name: "Saison en cours",
      displayVersion: "1.0.0",
      executable: "GameClient.exe",
      changelog: "- Version initiale",
      requirements: { ramGB: 8, cpuCores: 4 },
    },
  ],
};

/**
 * Lit backend/game_config.json (le crée avec les valeurs par défaut s'il
 * n'existe pas). Relu à chaque appel — le fichier reste petit même avec
 * plusieurs jeux, et ça permet d'éditer nom/version/changelog pendant que
 * le serveur tourne, sans le relancer (via edition manuelle ou le panel admin).
 *
 * `games` est un TABLEAU : chaque entrée devient un jeu distinct dans la
 * Library, avec son propre dossier `backend/game/<id>/`.
 */
function loadGameConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    const modules = {};
    for (const id of Object.keys(DEFAULT_CONFIG.modules)) {
      modules[id] = { ...DEFAULT_CONFIG.modules[id], ...parsed.modules?.[id] };
    }
    // Un module ajouté au catalogue après-coup, sans entrée existante dans
    // game_config.json, apparaît quand même (avec ses valeurs par défaut).
    for (const id of Object.keys(parsed.modules || {})) {
      if (!modules[id]) modules[id] = parsed.modules[id];
    }

    return {
      server: { ...DEFAULT_CONFIG.server, ...parsed.server },
      maintenance: { ...DEFAULT_CONFIG.maintenance, ...parsed.maintenance },
      modules,
      games: Array.isArray(parsed.games) && parsed.games.length ? parsed.games : DEFAULT_CONFIG.games,
    };
  } catch {
    console.warn(
      `[backend-dev] ${path.basename(CONFIG_PATH)} invalide, valeurs par défaut utilisées.`
    );
    return DEFAULT_CONFIG;
  }
}

function saveGameConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

module.exports = { loadGameConfig, saveGameConfig, CONFIG_PATH };
