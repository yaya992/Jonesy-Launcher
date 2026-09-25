const { autoUpdater } = require("electron-updater");
const { app } = require("electron");

/**
 * Auto-update via GitHub Releases (voir package.json → build.publish).
 * electron-builder publie `latest.yml` + l'installeur en tant qu'assets de
 * release ; electron-updater les lit à l'exécution pour savoir s'il existe
 * une version plus récente que celle installée.
 *
 * Comportement volontairement "automatique" de bout en bout :
 *  - vérifie au démarrage, puis toutes les heures
 *  - télécharge tout seul dès qu'une mise à jour est trouvée (autoDownload)
 *  - l'installe au prochain redémarrage normal du launcher
 *    (autoInstallOnAppQuit) — jamais en pleine partie, jamais en forçant un
 *    redémarrage immédiat sans prévenir
 *
 * Ne fait rien en dev (`npm run dev`) : un launcher non packagé n'a pas
 * l'installeur nécessaire pour appliquer une mise à jour, et electron-updater
 * lève une erreur si on essaie quand même.
 */
let mainWindowRef = null;
let latestInfo = null; // { version } de la dernière release téléchargée, pour l'UI

function initAutoUpdater(mainWindow) {
  mainWindowRef = mainWindow;

  if (!app.isPackaged) {
    console.log("[updater] Désactivé en dev (app non packagée).");
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (payload) => mainWindowRef?.webContents.send("updater:event", payload);

  autoUpdater.on("checking-for-update", () => send({ type: "checking" }));

  autoUpdater.on("update-available", (info) => {
    send({ type: "available", version: info.version });
  });

  autoUpdater.on("update-not-available", () => send({ type: "up-to-date" }));

  autoUpdater.on("download-progress", (progress) => {
    send({
      type: "downloading",
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    latestInfo = { version: info.version };
    send({ type: "downloaded", version: info.version });
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater]", err.message);
    send({ type: "error", message: err.message });
  });

  // Premier check peu après le démarrage (laisse l'UI se charger d'abord),
  // puis un rappel régulier — un launcher reste souvent ouvert des heures.
  setTimeout(() => checkForUpdates(), 10_000);
  setInterval(() => checkForUpdates(), 60 * 60 * 1000);
}

function checkForUpdates() {
  if (!app.isPackaged) return Promise.resolve(null);
  return autoUpdater.checkForUpdates().catch((err) => {
    console.error("[updater] Échec de la vérification :", err.message);
    return null;
  });
}

/** Redémarre immédiatement pour appliquer une mise à jour déjà téléchargée. */
function quitAndInstall() {
  if (!latestInfo) return; // rien de téléchargé, ne rien faire
  autoUpdater.quitAndInstall();
}

function getPendingUpdateVersion() {
  return latestInfo?.version ?? null;
}

module.exports = { initAutoUpdater, checkForUpdates, quitAndInstall, getPendingUpdateVersion };
