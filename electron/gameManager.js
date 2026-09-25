const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { app } = require("electron");
const { downloadFile, hashFile, hashPool } = require("./downloader");
const { getConfig } = require("./config");
const { getEndpoints } = require("./endpoints");

// Jeux affichés dans Library si le manifest distant est indisponible (fallback dev)
const FALLBACK_CATALOG = [
  {
    id: "season-main",
    name: "Saison en cours",
    version: "1.0.0",
    executable: "GameClient.exe",
    files: [],
  },
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Manifest inaccessible (HTTP ${res.statusCode})`));
        }
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

/**
 * Manifest attendu (par jeu) :
 * {
 *   "id": "season-main",
 *   "name": "Saison en cours",
 *   "version": "5.2.1",
 *   "executable": "GameClient.exe",
 *   "files": [
 *     { "path": "GameClient.exe", "url": "https://cdn/.../GameClient.exe", "size": 12345, "sha256": "..." },
 *     { "path": "paks/pakchunk0.pak", "url": "https://cdn/.../pakchunk0.pak", "size": 98765, "sha256": "..." }
 *   ]
 * }
 */
class GameManager {
  constructor(store) {
    this.store = store;
    this.cancelTokens = new Map(); // gameId -> { cancelled }
  }

  defaultInstallDir(gameId) {
    // %APPDATA%\<productId>\games\<gameId> sous Windows (équivalent natif sur
    // macOS/Linux via app.getPath("appData")) — un dossier propre et
    // prévisible, indépendant du dossier interne d'Electron (userData, qui
    // mélangerait ça avec les préférences/le cache).
    // `productId` (ex: "com.stef.launcher") sert de nom de dossier plutôt que
    // `app.name` (ex: "Game Launcher") : stable même si le nom affiché change,
    // et sans espaces ni accents qui compliqueraient des chemins Windows.
    return path.join(app.getPath("appData"), getConfig().app.productId, "games", gameId);
  }

  getInstallDir(gameId) {
    const paths = this.store.get("gamePaths") || {};
    return paths[gameId] || this.defaultInstallDir(gameId);
  }

  setInstallPath(gameId, folderPath) {
    const paths = this.store.get("gamePaths") || {};
    paths[gameId] = folderPath;
    this.store.set("gamePaths", paths);
    return { gameId, folderPath };
  }

  async listGames() {
    try {
      const manifest = await fetchJson(getEndpoints().manifest);
      return Array.isArray(manifest) ? manifest : [manifest];
    } catch {
      return FALLBACK_CATALOG;
    }
  }

  async getManifestFor(gameId) {
    const games = await this.listGames();
    const game = games.find((g) => g.id === gameId);
    if (!game) throw new Error(`Jeu inconnu: ${gameId}`);
    return game;
  }

  localManifestPath(gameId) {
    return path.join(this.getInstallDir(gameId), ".manifest.json");
  }

  isInstalled(gameId) {
    const localManifest = this.localManifestPath(gameId);
    const exePath = this.getExecutablePath(gameId);
    return fs.existsSync(localManifest) && exePath && fs.existsSync(exePath);
  }

  getExecutablePath(gameId) {
    const localManifestPath = this.localManifestPath(gameId);
    if (!fs.existsSync(localManifestPath)) return null;
    try {
      const local = JSON.parse(fs.readFileSync(localManifestPath, "utf-8"));
      return path.join(this.getInstallDir(gameId), local.executable);
    } catch {
      return null;
    }
  }

  async getStatus(gameId) {
    const installed = this.isInstalled(gameId);
    let upToDate = false;
    let remoteVersion = null;
    let displayVersion = null;
    let changelog = "";
    let requirements = null;
    let name = null;

    try {
      const remote = await this.getManifestFor(gameId);
      remoteVersion = remote.version;
      displayVersion = remote.displayVersion ?? remote.version;
      name = remote.name || null;
      changelog = remote.changelog || "";
      requirements = remote.requirements || null;
      if (installed) {
        const local = JSON.parse(fs.readFileSync(this.localManifestPath(gameId), "utf-8"));
        upToDate = local.version === remote.version;
      }
    } catch {
      // pas de réseau / manifest indisponible : on retombe sur la version affichée
      // enregistrée localement lors de la dernière installation, si dispo.
      if (installed) {
        try {
          const local = JSON.parse(fs.readFileSync(this.localManifestPath(gameId), "utf-8"));
          displayVersion = local.displayVersion ?? local.version;
        } catch {
          // rien de local non plus, displayVersion reste null
        }
      }
    }

    return {
      installed,
      upToDate,
      name,
      remoteVersion,
      displayVersion,
      changelog,
      requirements,
      installDir: this.getInstallDir(gameId),
    };
  }

  cancel(gameId) {
    const token = this.cancelTokens.get(gameId);
    if (token) token.cancelled = true;
  }

  /** À appeler à la fermeture de l'app pour terminer proprement les threads de hash. */
  destroy() {
    hashPool.destroy();
  }

  /** Installe (ou met à jour) un jeu en ne téléchargeant que ce qui manque/diffère. */
  async install(gameId, onProgress) {
    const manifest = await this.getManifestFor(gameId);
    return this._syncFiles(gameId, manifest, manifest.files, onProgress);
  }

  /** Vérifie tous les fichiers installés (hash) et rapporte les fichiers corrompus/absents. */
  async verify(gameId, onProgress) {
    const manifest = await this.getManifestFor(gameId);
    const installDir = this.getInstallDir(gameId);
    const total = manifest.files.length;
    const broken = [];
    let completed = 0;

    // Tous les fichiers partent en même temps : le pool de workers (hash-pool.js)
    // les hashe en parallèle (jusqu'à son nombre de threads), donc plusieurs
    // gros .pak sont vérifiés à la fois au lieu d'un par un.
    await Promise.all(
      manifest.files.map(async (file) => {
        const fullPath = path.join(installDir, file.path);
        let ok = fs.existsSync(fullPath);
        if (ok && file.sha256) {
          const actual = await hashFile(fullPath);
          ok = actual.toLowerCase() === file.sha256.toLowerCase();
        }
        if (!ok) broken.push(file.path);
        completed += 1;
        onProgress?.({ phase: "verify", current: completed, total, file: file.path, ok });
      })
    );

    return { broken, healthy: broken.length === 0 };
  }

  /** Répare : re-télécharge uniquement les fichiers manquants/corrompus détectés par verify(). */
  async repair(gameId, onProgress) {
    const manifest = await this.getManifestFor(gameId);
    const { broken } = await this.verify(gameId, onProgress);
    const filesToFetch = manifest.files.filter((f) => broken.includes(f.path));
    return this._syncFiles(gameId, manifest, filesToFetch, onProgress, { isRepair: true });
  }

  async _syncFiles(gameId, manifest, files, onProgress, { isRepair = false } = {}) {
    const installDir = this.getInstallDir(gameId);
    fs.mkdirSync(installDir, { recursive: true });

    const cancelToken = { cancelled: false };
    this.cancelTokens.set(gameId, cancelToken);

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0) || 1;
    let downloadedBytesBase = 0;
    const perFileDownloaded = new Map();

    // Vitesse lissée (moyenne mobile exponentielle) + ETA, mis à jour au
    // maximum 5x/seconde pour ne pas noyer l'UI d'événements IPC alors que
    // les callbacks de chunk peuvent arriver bien plus souvent.
    let lastReportAt = Date.now();
    let lastReportedBytes = 0;
    let smoothedSpeed = 0;
    const REPORT_INTERVAL_MS = 200;

    const reportGlobalProgress = (force = false) => {
      const totalDownloaded =
        downloadedBytesBase + [...perFileDownloaded.values()].reduce((a, b) => a + b, 0);

      const now = Date.now();
      const elapsed = now - lastReportAt;
      if (!force && elapsed < REPORT_INTERVAL_MS) return;

      if (elapsed > 0) {
        const instantSpeed = ((totalDownloaded - lastReportedBytes) / elapsed) * 1000;
        smoothedSpeed = smoothedSpeed ? smoothedSpeed * 0.7 + instantSpeed * 0.3 : instantSpeed;
      }
      lastReportAt = now;
      lastReportedBytes = totalDownloaded;

      const remainingBytes = Math.max(0, totalBytes - totalDownloaded);
      const etaSeconds =
        smoothedSpeed > 1024 ? Math.round(remainingBytes / smoothedSpeed) : null;

      onProgress?.({
        phase: isRepair ? "repair" : "download",
        bytesDownloaded: totalDownloaded,
        totalBytes,
        percent: Math.min(100, Math.round((totalDownloaded / totalBytes) * 100)),
        bytesPerSecond: Math.max(0, Math.round(smoothedSpeed)),
        etaSeconds,
      });
    };

    // Téléchargements en parallèle limité (configurable dans config.json → download.concurrency)
    const CONCURRENCY = getConfig().download.concurrency || 3;
    let index = 0;

    const worker = async () => {
      while (index < files.length) {
        if (cancelToken.cancelled) return;
        const file = files[index++];
        const destPath = path.join(installDir, file.path);

        // Skip rapide si déjà présent et intègre (évite de re-télécharger à chaque install)
        if (!isRepair && fs.existsSync(destPath) && file.sha256) {
          const actual = await hashFile(destPath).catch(() => null);
          if (actual && actual.toLowerCase() === file.sha256.toLowerCase()) {
            downloadedBytesBase += file.size;
            reportGlobalProgress(true);
            continue;
          }
        }

        await downloadFile(
          file.url,
          destPath,
          file.size,
          file.sha256,
          (downloaded) => {
            perFileDownloaded.set(file.path, downloaded);
            reportGlobalProgress();
          },
          cancelToken
        );

        downloadedBytesBase += file.size;
        perFileDownloaded.delete(file.path);
        reportGlobalProgress(true);
      }
    };

    try {
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));

      if (cancelToken.cancelled) {
        onProgress?.({ phase: "cancelled" });
        return { success: false, cancelled: true };
      }

      // Manifest local = trace de ce qui est réellement installé (version + exe)
      fs.writeFileSync(
        this.localManifestPath(gameId),
        JSON.stringify(
          {
            version: manifest.version,
            displayVersion: manifest.displayVersion ?? manifest.version,
            executable: manifest.executable,
            files: manifest.files,
          },
          null,
          2
        )
      );

      onProgress?.({ phase: "done", percent: 100 });
      return { success: true };
    } finally {
      this.cancelTokens.delete(gameId);
    }
  }
}

module.exports = { GameManager };
