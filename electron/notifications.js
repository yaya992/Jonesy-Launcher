// electron/notifications.js
//
// Connexion Socket.IO (client) au backend, pour recevoir les notifications
// poussées depuis le panel admin en temps réel (pas de polling).
//
// Affiche une notification Windows native (visible même si le launcher est
// réduit dans la barre système) ET relaie l'événement au renderer pour un
// toast dans l'UI (voir src/hooks/useNotifications.js).

const { Notification } = require("electron");
const { io } = require("socket.io-client");
const { getConfig } = require("./config");

let socket = null;

function initNotifications(getMainWindow) {
  const serverUrl = getConfig().server.url;
  if (!serverUrl) return;

  socket = io(serverUrl, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 3000,
    reconnectionDelayMax: 15000,
  });

  socket.on("notification", (payload) => {
    if (!payload || !payload.title) return;

    if (Notification.isSupported()) {
      new Notification({
        title: payload.title,
        body: payload.message || "",
      }).show();
    }

    getMainWindow()?.webContents.send("notification:push", payload);
  });

  // Volontairement silencieux : le launcher doit rester utilisable même sans
  // canal temps réel (le client socket.io retente tout seul en arrière-plan,
  // avec un backoff progressif via reconnectionDelay/reconnectionDelayMax).
  socket.on("connect_error", () => {});
}

function destroyNotifications() {
  socket?.disconnect();
  socket = null;
}

module.exports = { initNotifications, destroyNotifications };
