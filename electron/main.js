const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const Store = require("electron-store");
const { spawn, exec } = require("child_process");

const { GameManager } = require("./gameManager");
const { AuthService } = require("./authService");
const { getConfig, getConfigPath, reloadConfig } = require("./config");
const { getEndpoints } = require("./endpoints");
const { getSystemInfo, checkRequirements } = require("./systemInfo");
const { getMaintenance, getServiceStatus } = require("./statusService");
const { initAutoUpdater, checkForUpdates, quitAndInstall, getPendingUpdateVersion } = require("./updater");

const isDev = process.env.NODE_ENV === "development";
const config = getConfig();

// Stockage persistant local (chemins d'installation, comptes, préférences…)
const store = new Store({
  name: "launcher-config",
  defaults: {
    gamePaths: {},
    accounts: [],
    activeEmail: null,
    // Préférences utilisateur, initialisées depuis config.json mais
    // modifiables ensuite depuis la page Settings.
    preferences: {
      minimizeToTray: config.behavior?.minimizeToTray ?? true,
      launchAtStartup: config.behavior?.launchAtStartup ?? false,
    },
  },
});

const gameManager = new GameManager(store);
const authService = new AuthService(store);

let mainWindow;
let tray = null;
let isQuitting = false;

function getPreferences() {
  return store.get("preferences");
}

/** Applique la préférence "lancer au démarrage de Windows" au niveau de l'OS. */
function applyLaunchAtStartup(enabled) {
  // openAsHidden : sous Windows/macOS, démarrer réduit plutôt qu'en ouvrant
  // une fenêtre au visage de l'utilisateur à chaque boot.
  app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true });
}

function createTray() {
  if (tray) return;

  // Icône générée à la volée : évite de dépendre d'un asset externe. Remplace
  // par nativeImage.createFromPath(...) si tu ajoutes une vraie icône.
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip(getConfig().app.name);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Ouvrir le launcher",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: "separator" },
    {
      label: "Quitter",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    minWidth: config.window.minWidth,
    minHeight: config.window.minHeight,
    // Le titre natif (barre des tâches, Alt-Tab) vient de config.json →
    // app.name, pas du <title> statique d'index.html. `page-title-updated`
    // est bloqué juste en dessous pour que ce nom ne soit jamais écrasé par
    // celui, figé au build, de la page chargée.
    title: config.app.name,
    frame: false, // on gère une barre de titre custom côté React
    backgroundColor: "#0a0a0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on("page-title-updated", (event) => event.preventDefault());

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  // Fermer la fenêtre réduit dans le tray au lieu de quitter, si l'option
  // est active — le vrai quit passe par le menu du tray ou app.quit().
  mainWindow.on("close", (event) => {
    if (isQuitting || !getPreferences().minimizeToTray) return;
    event.preventDefault();
    mainWindow.hide();
  });

  // Les liens externes s'ouvrent dans le navigateur système, jamais dans l'app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  applyLaunchAtStartup(getPreferences().launchAtStartup);
  initAutoUpdater(mainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // Avec le tray actif, fermer la dernière fenêtre ne doit pas tuer l'app.
  if (process.platform !== "darwin" && !getPreferences().minimizeToTray) app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  gameManager.destroy();
  gameWatchers.forEach((interval) => clearInterval(interval));
  gameWatchers.clear();
});

/* ------------------------------------------------------------------ */
/* IPC — Fenêtre (barre de titre custom)                               */
/* ------------------------------------------------------------------ */
ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:maximize", () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on("window:close", () => mainWindow?.close());

ipcMain.handle("shell:openExternal", async (_e, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) {
    shell.openExternal(url);
  }
});

/* ------------------------------------------------------------------ */
/* IPC — Authentification (multi-comptes)                              */
/* ------------------------------------------------------------------ */
ipcMain.handle("auth:login", async (_e, credentials) => {
  return authService.login(credentials);
});

ipcMain.handle("auth:logout", async () => {
  return authService.logout();
});

ipcMain.handle("auth:me", async () => {
  return authService.getStoredAccount();
});

ipcMain.handle("auth:listAccounts", async () => {
  return authService.listAccounts();
});

ipcMain.handle("auth:switchAccount", async (_e, email) => {
  return authService.switchAccount(email);
});

ipcMain.handle("auth:removeAccount", async (_e, email) => {
  return authService.removeAccount(email);
});

/** Petit GET JSON générique, tolérant : ne rejette jamais, renvoie `fallback` sur tout échec. */
function fetchJsonOrDefault(url, fallback) {
  if (!url) return Promise.resolve(fallback);
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(fallback);
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(fallback);
        }
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(fallback));
  });
}

/* ------------------------------------------------------------------ */
/* IPC — Actualités                                                    */
/* ------------------------------------------------------------------ */
ipcMain.handle("news:list", async () => {
  const result = await fetchJsonOrDefault(getEndpoints().news, []);
  return Array.isArray(result) ? result : [];
});

/* ------------------------------------------------------------------ */
/* IPC — FAQ                                                           */
/* ------------------------------------------------------------------ */
ipcMain.handle("content:faq", async () => {
  const result = await fetchJsonOrDefault(getEndpoints().faq, null);
  return result?.body ? result : null;
});

/* ------------------------------------------------------------------ */
/* IPC — Réseaux sociaux                                                */
/* ------------------------------------------------------------------ */
ipcMain.handle("content:socials", async () => {
  const result = await fetchJsonOrDefault(getEndpoints().socials, []);
  return Array.isArray(result) ? result : [];
});

/* ------------------------------------------------------------------ */
/* IPC — Statut serveur (module serverStatus)                          */
/* ------------------------------------------------------------------ */
ipcMain.handle("content:serverStatus", async () => {
  return fetchJsonOrDefault(getEndpoints().serverStatus, null);
});

/* ------------------------------------------------------------------ */
/* IPC — Équipe                                                        */
/* ------------------------------------------------------------------ */
ipcMain.handle("content:credits", async () => {
  const result = await fetchJsonOrDefault(getEndpoints().credits, []);
  return Array.isArray(result) ? result : [];
});

/* ------------------------------------------------------------------ */
/* IPC — Statut du service (maintenance + modules activés)             */
/* ------------------------------------------------------------------ */
ipcMain.handle("status:get", async () => getServiceStatus());

/* ------------------------------------------------------------------ */
/* IPC — Système (prérequis matériels)                                 */
/* ------------------------------------------------------------------ */
ipcMain.handle("system:info", async () => getSystemInfo());

ipcMain.handle("app:getVersion", async () => app.getVersion());

ipcMain.handle("system:checkRequirements", async (_e, requirements) =>
  checkRequirements(requirements)
);

/* ------------------------------------------------------------------ */
/* IPC — Bibliothèque de jeux / téléchargement / réparation           */
/* ------------------------------------------------------------------ */
ipcMain.handle("library:list", async () => {
  return gameManager.listGames();
});

ipcMain.handle("library:status", async (_e, gameId) => {
  return gameManager.getStatus(gameId);
});

ipcMain.handle("library:install", async (_e, gameId) => {
  const maintenance = await getMaintenance();
  if (maintenance.enabled && !maintenance.allowDownloads) {
    throw new Error("MAINTENANCE");
  }

  gameManager.install(gameId, (progress) => {
    mainWindow?.webContents.send("download:progress", { gameId, ...progress });
  });
  return { started: true };
});

ipcMain.handle("library:verify", async (_e, gameId) => {
  return gameManager.verify(gameId, (progress) => {
    mainWindow?.webContents.send("verify:progress", { gameId, ...progress });
  });
});

ipcMain.handle("library:repair", async (_e, gameId) => {
  gameManager.repair(gameId, (progress) => {
    mainWindow?.webContents.send("download:progress", { gameId, ...progress });
  });
  return { started: true };
});

ipcMain.handle("library:cancel", async (_e, gameId) => {
  gameManager.cancel(gameId);
  return { cancelled: true };
});

ipcMain.handle("library:setPath", async (_e, { gameId, folderPath }) => {
  return gameManager.setInstallPath(gameId, folderPath);
});

ipcMain.handle("library:chooseFolder", async (_e, gameId) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choisir le dossier d'installation",
    properties: ["openDirectory", "createDirectory"],
    defaultPath: gameManager.getInstallDir(gameId),
  });

  if (result.canceled || !result.filePaths[0]) return null;

  const folderPath = result.filePaths[0];
  gameManager.setInstallPath(gameId, folderPath);
  return { folderPath };
});

/* ------------------------------------------------------------------ */
/* IPC — Lancement du jeu                                              */
/* ------------------------------------------------------------------ */
/**
 * Lance un exécutable avec élévation UAC sous Windows, via PowerShell
 * `Start-Process -Verb RunAs`. Nécessaire pour les anti-cheats : la plupart
 * embarquent un manifeste `requireAdministrator` (installation d'un driver,
 * hooks bas niveau…), et `child_process.spawn` seul ne peut pas déclencher
 * l'invite UAC — Windows renvoie alors ERROR_ELEVATION_REQUIRED, que Node
 * traduit en `EACCES` au lieu d'un message clair.
 *
 * `-PassThru` fait renvoyer par PowerShell le PID du process élevé (imprimé
 * sur stdout) sans attendre sa fin — powershell.exe lui-même se termine vite,
 * une fois l'anticheat lancé. Le PID renvoyé sert ensuite à surveiller la
 * fermeture du jeu (voir watchWindowsProcess), puisque ce process élevé
 * n'est pas un enfant direct que Node peut suivre via son propre handle.
 *
 * Résout avec le PID, ou rejette si l'UAC est refusée/annulée ou si le
 * lancement échoue pour une autre raison.
 */
function launchElevatedWindows(exePath, args, cwd) {
  return new Promise((resolve, reject) => {
    const escape = (s) => `'${String(s).replace(/'/g, "''")}'`;
    const argList = args.map(escape).join(",");
    const command = [
      "try {",
      "$p = Start-Process",
      `-FilePath ${escape(exePath)}`,
      args.length ? `-ArgumentList ${argList}` : "",
      `-WorkingDirectory ${escape(cwd)}`,
      "-Verb RunAs -PassThru;",
      "Write-Output $p.Id",
      "} catch { Write-Error $_; exit 1 }",
    ]
      .filter(Boolean)
      .join(" ");

    const ps = spawn("powershell.exe", ["-NoProfile", "-Command", command], {
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    ps.stdout?.on("data", (d) => (stdout += d));
    ps.stderr?.on("data", (d) => (stderr += d));
    ps.on("error", reject);
    ps.on("exit", (code) => {
      const pid = parseInt(stdout.trim(), 10);
      if (code === 0 && Number.isInteger(pid)) {
        resolve(pid);
      } else {
        reject(new Error(stderr.trim() || `Élévation refusée ou annulée (code ${code}).`));
      }
    });
  });
}

/** true si un process avec ce PID tourne encore (Windows, via tasklist — pas besoin de droits admin pour lister). */
function isProcessRunningWindows(pid) {
  return new Promise((resolve) => {
    exec(`tasklist /FI "PID eq ${pid}" /NH`, (err, stdout) => {
      if (err) return resolve(false);
      resolve(stdout.includes(String(pid)));
    });
  });
}

// gameId -> intervalId, pour ne jamais avoir deux surveillances actives sur
// le même jeu (ex: si le joueur relance vite avant que la précédente ait fini).
const gameWatchers = new Map();

// Source de vérité pour "ce jeu tourne-t-il actuellement ?" — interrogée par
// le renderer à chaque montage (voir IPC game:isRunning). Sans ça, l'état
// "En cours" ne vivait que dans le useState du composant Home/LibraryItem :
// changer d'onglet démonte le composant, qui repart de zéro au retour, même
// si le jeu tourne toujours pour de vrai.
const runningGames = new Set();

function markGameExited(gameId) {
  runningGames.delete(gameId);
  mainWindow?.webContents.send("game:exited", { gameId });
}

/** Poll jusqu'à ce que le process quitte, puis prévient le renderer pour réactiver le bouton. */
function watchWindowsProcess(gameId, pid) {
  clearInterval(gameWatchers.get(gameId));
  const interval = setInterval(async () => {
    const running = await isProcessRunningWindows(pid);
    if (!running) {
      clearInterval(interval);
      gameWatchers.delete(gameId);
      markGameExited(gameId);
    }
  }, 4000);
  gameWatchers.set(gameId, interval);
}

ipcMain.handle("game:isRunning", async (_e, gameId) => runningGames.has(gameId));

ipcMain.handle("game:launch", async (_e, gameId) => {
  // Vérification côté process principal : même si l'UI est contournée, le
  // jeu ne démarre pas pendant une maintenance.
  const maintenance = await getMaintenance();
  if (maintenance.enabled) {
    throw new Error("MAINTENANCE");
  }

  if (!gameManager.isInstalled(gameId)) {
    throw new Error("Jeu introuvable ou non installé.");
  }

  const credentials = authService.getLaunchCredentials();
  if (!credentials) {
    throw new Error("SESSION_EXPIRED");
  }

  // Le jeu se lance toujours via l'anticheat, placé à la racine du dossier
  // d'installation (téléchargé comme n'importe quel autre fichier du manifest).
  const installDir = gameManager.getInstallDir(gameId);
  const anticheatName = getConfig().game.launchExecutable;
  const anticheatPath = path.join(installDir, anticheatName);

  if (!fs.existsSync(anticheatPath)) {
    throw new Error(`${anticheatName} introuvable dans le dossier du jeu.`);
  }

  const args = [`-email=${credentials.email}`, `-mdp=${credentials.password}`];

  if (process.platform === "win32") {
    // La quasi-totalité des anti-cheats exigent l'élévation (voir
    // launchElevatedWindows ci-dessus) — c'est ce qui déclenche l'invite
    // UAC que le joueur voit s'afficher au clic sur Jouer.
    let pid;
    try {
      pid = await launchElevatedWindows(anticheatPath, args, installDir);
    } catch (err) {
      throw new Error(
        `Impossible de lancer ${anticheatName} avec les droits administrateur : ${err.message}`
      );
    }
    runningGames.add(gameId);
    watchWindowsProcess(gameId, pid);
    return { launched: true, pid };
  }

  const child = spawn(anticheatPath, args, {
    cwd: installDir,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  runningGames.add(gameId);
  child.on("exit", () => {
    markGameExited(gameId);
  });

  return { launched: true, pid: child.pid };
});

/* ------------------------------------------------------------------ */
/* IPC — Réglages                                                      */
/* ------------------------------------------------------------------ */
ipcMain.handle("settings:get", async () => {
  return {
    preferences: getPreferences(),
  };
});

ipcMain.handle("settings:setPreference", async (_e, { key, value }) => {
  const preferences = { ...getPreferences(), [key]: value };
  store.set("preferences", preferences);

  if (key === "launchAtStartup") applyLaunchAtStartup(value);

  return preferences;
});

// Sous-ensemble non sensible de config.json, affichable dans Settings
// (nom de l'app, serveurs contactés) — pas de secrets à exposer ici.
ipcMain.handle("settings:getConfig", async () => {
  const c = getConfig();
  return {
    appName: c.app.name,
    serverUrl: c.server.url,
    configPath: getConfigPath(),
  };
});

// Permet de recharger config.json sans relancer le launcher (après une
// édition manuelle par exemple) — gameManager/authService relisent via getConfig().
ipcMain.handle("settings:reloadConfig", async () => {
  reloadConfig();
  return getConfig();
});

/* ------------------------------------------------------------------ */
/* IPC — Mise à jour du launcher (GitHub Releases)                     */
/* ------------------------------------------------------------------ */
ipcMain.handle("updater:check", async () => {
  await checkForUpdates();
  return { pendingVersion: getPendingUpdateVersion() };
});

ipcMain.handle("updater:quitAndInstall", async () => {
  quitAndInstall();
});

ipcMain.handle("settings:openFolder", async (_e, folderPath) => {
  shell.openPath(folderPath);
});
