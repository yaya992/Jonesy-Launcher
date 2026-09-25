const { contextBridge, ipcRenderer } = require("electron");

// Aucune API Node/Electron brute n'est exposée : seulement des fonctions
// précises, ce qui garde nodeIntegration désactivée côté renderer (sécurité).
contextBridge.exposeInMainWorld("launcher", {
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
  },

  auth: {
    login: (credentials) => ipcRenderer.invoke("auth:login", credentials),
    logout: () => ipcRenderer.invoke("auth:logout"),
    me: () => ipcRenderer.invoke("auth:me"),
    listAccounts: () => ipcRenderer.invoke("auth:listAccounts"),
    switchAccount: (email) => ipcRenderer.invoke("auth:switchAccount", email),
    removeAccount: (email) => ipcRenderer.invoke("auth:removeAccount", email),
  },

  news: {
    list: () => ipcRenderer.invoke("news:list"),
  },

  content: {
    faq: () => ipcRenderer.invoke("content:faq"),
    socials: () => ipcRenderer.invoke("content:socials"),
    serverStatus: () => ipcRenderer.invoke("content:serverStatus"),
    credits: () => ipcRenderer.invoke("content:credits"),
  },

  shell: {
    openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  },

  status: {
    get: () => ipcRenderer.invoke("status:get"),
  },

  system: {
    info: () => ipcRenderer.invoke("system:info"),
    checkRequirements: (requirements) =>
      ipcRenderer.invoke("system:checkRequirements", requirements),
  },

  app: {
    getVersion: () => ipcRenderer.invoke("app:getVersion"),
  },

  library: {
    list: () => ipcRenderer.invoke("library:list"),
    status: (gameId) => ipcRenderer.invoke("library:status", gameId),
    install: (gameId) => ipcRenderer.invoke("library:install", gameId),
    verify: (gameId) => ipcRenderer.invoke("library:verify", gameId),
    repair: (gameId) => ipcRenderer.invoke("library:repair", gameId),
    cancel: (gameId) => ipcRenderer.invoke("library:cancel", gameId),
    setPath: (gameId, folderPath) =>
      ipcRenderer.invoke("library:setPath", { gameId, folderPath }),
    chooseFolder: (gameId) => ipcRenderer.invoke("library:chooseFolder", gameId),
    onDownloadProgress: (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on("download:progress", handler);
      return () => ipcRenderer.removeListener("download:progress", handler);
    },
    onVerifyProgress: (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on("verify:progress", handler);
      return () => ipcRenderer.removeListener("verify:progress", handler);
    },
  },

  game: {
    launch: (gameId) => ipcRenderer.invoke("game:launch", gameId),
    isRunning: (gameId) => ipcRenderer.invoke("game:isRunning", gameId),
    onExited: (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on("game:exited", handler);
      return () => ipcRenderer.removeListener("game:exited", handler);
    },
  },

  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    openFolder: (folderPath) => ipcRenderer.invoke("settings:openFolder", folderPath),
    getConfig: () => ipcRenderer.invoke("settings:getConfig"),
    reloadConfig: () => ipcRenderer.invoke("settings:reloadConfig"),
    setPreference: (key, value) => ipcRenderer.invoke("settings:setPreference", { key, value }),
  },

  updater: {
    check: () => ipcRenderer.invoke("updater:check"),
    quitAndInstall: () => ipcRenderer.invoke("updater:quitAndInstall"),
    onEvent: (cb) => {
      const handler = (_e, payload) => cb(payload);
      ipcRenderer.on("updater:event", handler);
      return () => ipcRenderer.removeListener("updater:event", handler);
    },
  },
});
