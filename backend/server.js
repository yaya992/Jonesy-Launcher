/**
 * Backend de développement local uniquement.
 *
 * → Chaque jeu déclaré dans backend/game_config.json (tableau `games`) a son
 *   propre dossier backend/game/<id>/ — dépose les vrais fichiers dedans
 *   (n'importe quelle arborescence). Ajout/modif/suppression régénère
 *   automatiquement le manifest de CE jeu (les autres ne sont pas retouchés).
 *
 * → Nom, version affichée, changelog, requirements (RAM/CPU) par jeu, port
 *   du serveur, mot de passe admin : tout dans backend/game_config.json.
 *
 * → Actualités affichées sur la Home du launcher : backend/news.json.
 *
 * → Panel admin minimal sur http://localhost:<port>/admin (protégé par
 *   `server.adminPassword`) pour éditer jeux/changelog/news sans SSH.
 *
 * Sert :
 *  - GET  /launcher/manifest.json   → manifest de tous les jeux configurés
 *  - GET  /launcher/files/:id/*     → fichiers réels d'un jeu, téléchargés par le launcher
 *  - GET  /launcher/news            → actualités (publique, pas d'auth)
 *  - POST /launcher/login           → login factice
 *  - /admin, /admin/api/*           → panel d'administration (protégé)
 *
 * Ce dossier n'est JAMAIS packagé dans le build Electron (voir package.json
 * → build.files) : en prod, un vrai backend sert ces mêmes routes, son URL
 * étant réglée dans electron/config.default.json.
 */
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const chokidar = require("chokidar");
const { buildFileList, hashPool } = require("./manifest-builder");
const { loadGameConfig, saveGameConfig } = require("./game-config");
const { loadNews, saveNews } = require("./news");
const { loadFaq, saveFaq } = require("./faq");
const { loadSocials, saveSocials } = require("./socials");
const { getServerStatus } = require("./server-status");
const { loadCredits, saveCredits } = require("./credits");
const { loadNotifications, pushNotification } = require("./notifications");
const { MODULE_CATALOG } = require("./module-catalog");

const GAME_ROOT = path.join(__dirname, "game"); // contient un sous-dossier par jeu (game/<id>/)
const MANIFEST_PATH = path.join(__dirname, "manifest.json"); // snapshot lisible, régénéré à chaque changement

// gameId -> { files, version } — un état séparé par jeu
const fileListStates = new Map();

function gameDirFor(gameId) {
  return path.join(GAME_ROOT, gameId);
}

function cachePathFor(gameId) {
  return path.join(__dirname, `.manifest-cache.${gameId}.json`);
}

function seedSampleFilesIfEmpty(game) {
  const dir = gameDirFor(game.id);
  fs.mkdirSync(dir, { recursive: true });
  const hasRealFiles = fs.readdirSync(dir).some((name) => !name.startsWith("."));
  if (hasRealFiles) return;

  console.log(`[backend-dev] game/${game.id}/ est vide → dépôt de fichiers de démo.`);
  fs.writeFileSync(
    path.join(dir, game.executable),
    "Faux exécutable de démo — remplace ce fichier par ton vrai build.\n"
  );
  fs.mkdirSync(path.join(dir, "paks"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "paks", "pakchunk0.pak"),
    crypto.randomBytes(20 * 1024 * 1024) // ~20 Mo, pour voir une vraie progress bar
  );
}

async function rebuildManifestForGame(game, reason) {
  const startedAt = Date.now();
  const fileList = await buildFileList({ gameDir: gameDirFor(game.id), cachePath: cachePathFor(game.id) });
  fileListStates.set(game.id, fileList);
  const ms = Date.now() - startedAt;
  console.log(
    `[backend-dev] [${game.id}] Manifest régénéré (${reason}) — ${fileList.files.length} fichier(s), ` +
      `hash ${fileList.version}, version affichée "${game.displayVersion}", ${ms} ms`
  );
}

/** Combine la config + les états en mémoire, et écrit le snapshot lisible sur disque. */
function writeManifestSnapshot(baseUrl = "") {
  const { games } = loadGameConfig();
  const manifests = games.map((game) => buildGameManifest(game, baseUrl));
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifests, null, 2));
  return manifests;
}

function buildGameManifest(game, baseUrl) {
  const fileList = fileListStates.get(game.id) || { files: [], version: "empty" };
  return {
    id: game.id,
    name: game.name,
    version: fileList.version, // hash technique, auto — sert à détecter les changements
    displayVersion: game.displayVersion, // libellé humain, manuel
    executable: game.executable,
    changelog: game.changelog || "",
    requirements: game.requirements || null,
    files: fileList.files.map((f) => ({
      ...f,
      url: `${baseUrl}/launcher/files/${game.id}/${f.path}`,
    })),
  };
}

// Un cran de debounce + une chaîne de promesses PAR JEU : modifier season-main
// ne fait jamais attendre/bloquer la régénération d'un autre jeu, et deux
// modifs successives du même jeu ne se chevauchent jamais.
const debounceTimers = new Map();
const rebuildChains = new Map();
function scheduleRebuild(gameId, reason) {
  clearTimeout(debounceTimers.get(gameId));
  debounceTimers.set(
    gameId,
    setTimeout(() => {
      const prevChain = rebuildChains.get(gameId) || Promise.resolve();
      const nextChain = prevChain
        .then(async () => {
          const { games } = loadGameConfig();
          const game = games.find((g) => g.id === gameId);
          if (!game) return; // jeu retiré de la config entre-temps
          await rebuildManifestForGame(game, reason);
          writeManifestSnapshot();
        })
        .catch((err) => console.error(`[backend-dev] [${gameId}] Échec de régénération : ${err.message}`));
      rebuildChains.set(gameId, nextChain);
    }, 400)
  );
}

/** Auth basique pour /admin — seul le mot de passe (server.adminPassword) compte. */
function requireAdminAuth(req, res, next) {
  const expected = loadGameConfig().server.adminPassword;
  if (!expected) return next(); // pas de mot de passe configuré = admin ouvert (dev only)

  const header = req.headers.authorization || "";
  const match = header.match(/^Basic (.+)$/);
  if (!match) {
    res.set("WWW-Authenticate", 'Basic realm="admin"');
    return res.status(401).send("Authentification requise.");
  }
  const [, password = ""] = Buffer.from(match[1], "base64").toString("utf-8").split(":");
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    res.set("WWW-Authenticate", 'Basic realm="admin"');
    return res.status(401).send("Mot de passe incorrect.");
  }
  next();
}

async function main() {
  const { games } = loadGameConfig();
  for (const game of games) {
    fs.mkdirSync(GAME_ROOT, { recursive: true });
    seedSampleFilesIfEmpty(game);
    await rebuildManifestForGame(game, "démarrage");
  }
  writeManifestSnapshot();

  chokidar
    .watch(GAME_ROOT, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 300 } })
    .on("all", (event, changedPath) => {
      const rel = path.relative(GAME_ROOT, changedPath);
      const gameId = rel.split(path.sep)[0];
      if (!gameId || gameId.startsWith(".")) return;
      scheduleRebuild(gameId, `${event}: ${rel}`);
    });

  const app = express();
  app.use(express.json());

  const httpServer = http.createServer(app);
  // CORS ouvert : le launcher (Electron, protocole file:// ou origine
  // arbitraire selon la machine du joueur) doit pouvoir se connecter depuis
  // n'importe où — c'est un canal de diffusion en lecture seule côté client,
  // pas une API sensible.
  const io = new Server(httpServer, { cors: { origin: "*" } });

  io.on("connection", (socket) => {
    console.log(`[backend-dev] Launcher connecté (${io.engine.clientsCount} au total)`);
    socket.on("disconnect", () => {
      console.log(`[backend-dev] Launcher déconnecté (${io.engine.clientsCount} au total)`);
    });
  });

  app.get("/launcher/manifest.json", (req, res) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const { games } = loadGameConfig(); // relu à chaque requête : effet immédiat des edits
    res.json(games.map((game) => buildGameManifest(game, baseUrl)));
  });

  app.use("/launcher/files", express.static(GAME_ROOT));

  // Statut du service, interrogé régulièrement par le launcher.
  // Volontairement très léger : c'est la route la plus appelée.
  app.get("/launcher/status", (req, res) => {
    const { maintenance, modules } = loadGameConfig();
    res.json({
      maintenance: {
        enabled: Boolean(maintenance.enabled),
        message: maintenance.message || "",
        allowDownloads: maintenance.allowDownloads !== false,
      },
      // Chaque module renvoie son `enabled` + les seuls params déclarés
      // `publicParams` dans le catalogue (ex: l'URL Discord) — le reste
      // (ex: maxPosts, qui ne sert qu'au découpage côté serveur) reste interne.
      // S'y ajoute, le cas échéant, le résultat de `liveDataProvider` (ex:
      // "live" pour Twitch) — recalculé à chaque appel, contrairement aux
      // publicParams qui viennent tels quels de la config.
      modules: Object.fromEntries(
        Object.entries(modules).map(([id, mod]) => {
          const catalogEntry = MODULE_CATALOG.find((m) => m.id === id);
          const publicParams = catalogEntry?.publicParams || [];
          const publicData = Object.fromEntries(publicParams.map((key) => [key, mod?.[key]]));
          const liveData = catalogEntry?.liveDataProvider?.() || {};
          return [id, { enabled: Boolean(mod?.enabled), ...publicData, ...liveData }];
        })
      ),
    });
  });

  app.get("/launcher/news", (req, res) => {
    const newsConfig = loadGameConfig().modules.news;
    // Module désactivé : la route disparaît plutôt que de répondre avec du
    // contenu que personne n'a demandé à afficher.
    if (!newsConfig?.enabled) return res.status(404).end();
    const maxPosts = newsConfig.maxPosts || 5;
    res.json(loadNews().slice(0, maxPosts));
  });

  app.get("/launcher/faq", (req, res) => {
    if (!loadGameConfig().modules.faq?.enabled) return res.status(404).end();
    res.json(loadFaq());
  });

  app.get("/launcher/socials", (req, res) => {
    if (!loadGameConfig().modules.socials?.enabled) return res.status(404).end();
    res.json(loadSocials());
  });

  app.get("/launcher/server-status", (req, res) => {
    if (!loadGameConfig().modules.serverStatus?.enabled) return res.status(404).end();
    res.json(getServerStatus());
  });

  app.get("/launcher/credits", (req, res) => {
    if (!loadGameConfig().modules.credits?.enabled) return res.status(404).end();
    res.json(loadCredits());
  });

  app.post("/launcher/login", (req, res) => {
    const { maintenance } = loadGameConfig();
    if (maintenance.enabled) {
      // 503 : le launcher affiche l'écran de maintenance au lieu d'une
      // erreur de connexion, qui laisserait croire à un mauvais mot de passe.
      return res.status(503).json({
        maintenance: true,
        message: maintenance.message || "Service en maintenance.",
      });
    }

    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Identifiants manquants." });
    }
    // Démo : n'importe quel email/mot de passe non vide est accepté
    return res.json({
      token: `dev-token-${Date.now()}`,
      account: {
        username: email.split("@")[0],
        displayName: email.split("@")[0],
        avatarUrl: null,
      },
    });
  });

  // --- Panel admin (protégé par server.adminPassword) ---
  app.use("/admin", requireAdminAuth, express.static(path.join(__dirname, "public")));

  app.get("/admin/api/config", requireAdminAuth, (req, res) => {
    res.json(loadGameConfig());
  });

  app.get("/admin/api/modules/catalog", requireAdminAuth, (req, res) => {
    res.json(MODULE_CATALOG);
  });

  app.put("/admin/api/config", requireAdminAuth, async (req, res) => {
    const incoming = req.body;
    if (!incoming || !Array.isArray(incoming.games) || typeof incoming.server !== "object") {
      return res.status(400).json({ message: "Format de config invalide." });
    }
    saveGameConfig(incoming);
    // Un jeu ajouté via l'admin doit avoir son dossier + manifest tout de suite
    for (const game of incoming.games) {
      seedSampleFilesIfEmpty(game);
      await rebuildManifestForGame(game, "édition admin");
    }
    writeManifestSnapshot();
    res.json({ ok: true });
  });

  app.get("/admin/api/news", requireAdminAuth, (req, res) => {
    res.json(loadNews());
  });

  app.put("/admin/api/news", requireAdminAuth, (req, res) => {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: "Format d'actualités invalide." });
    }
    saveNews(req.body);
    res.json({ ok: true });
  });

  app.get("/admin/api/faq", requireAdminAuth, (req, res) => {
    res.json(loadFaq());
  });

  app.put("/admin/api/faq", requireAdminAuth, (req, res) => {
    if (typeof req.body?.body !== "string") {
      return res.status(400).json({ message: "Format de FAQ invalide." });
    }
    saveFaq(req.body);
    res.json({ ok: true });
  });

  app.get("/admin/api/socials", requireAdminAuth, (req, res) => {
    res.json(loadSocials());
  });

  app.put("/admin/api/socials", requireAdminAuth, (req, res) => {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: "Format de réseaux sociaux invalide." });
    }
    saveSocials(req.body);
    res.json({ ok: true });
  });

  app.get("/admin/api/credits", requireAdminAuth, (req, res) => {
    res.json(loadCredits());
  });

  app.put("/admin/api/credits", requireAdminAuth, (req, res) => {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ message: "Format d'équipe invalide." });
    }
    saveCredits(req.body);
    res.json({ ok: true });
  });

  const NOTIFICATION_TYPES = ["update", "announcement", "info", "alert"];

  app.get("/admin/api/notifications", requireAdminAuth, (req, res) => {
    res.json(loadNotifications());
  });

  app.post("/admin/api/notify", requireAdminAuth, (req, res) => {
    const { type, title, message } = req.body || {};
    if (!NOTIFICATION_TYPES.includes(type)) {
      return res.status(400).json({ message: `Type invalide (attendu : ${NOTIFICATION_TYPES.join(", ")}).` });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Titre requis." });
    }

    const notification = pushNotification({ type, title: title.trim(), message: (message || "").trim() });
    io.emit("notification", notification);
    console.log(`[backend-dev] Notification envoyée à ${io.engine.clientsCount} launcher(s) : [${type}] ${title}`);
    res.json({ ok: true, notification });
  });

  const { server: serverConfig } = loadGameConfig();
  const PORT = process.env.DEV_BACKEND_PORT || serverConfig.port;

  const server = httpServer.listen(PORT, () => {
    console.log(`[backend-dev] Backend sur http://localhost:${PORT}`);
    console.log(`[backend-dev] Panel admin sur http://localhost:${PORT}/admin`);
    console.log(`[backend-dev] Socket.IO prêt sur le même port (notifications temps réel)`);
    console.log(`[backend-dev] Dossier surveillé : ${GAME_ROOT}`);
  });

  const shutdown = async () => {
    server.close();
    await hashPool.destroy();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
