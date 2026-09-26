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
const { checkForUpdates } = require("./updater");

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

    // Une notif "Mise à jour" sert aussi de déclencheur : les launchers déjà
    // ouverts vérifient tout de suite au lieu d'attendre le prochain cycle
    // horaire d'electron-updater (voir updater.js). L'UI existante
    // (UpdateBanner / useUpdater) réagit automatiquement aux événements que
    // checkForUpdates() génère déjà — rien d'autre à brancher côté renderer.
    if (payload.type === "update") {
      checkForUpdates();
    }
  });

  // Poussé par le backend quand l'admin change la maintenance (voir
  // PUT /admin/api/config côté serveur) — on ne pousse pas l'objet
  // directement : on demande au renderer de relire /launcher/status tout de
  // suite, pour rester sur une seule et même logique de validation/format
  // que le polling habituel (status:get), au lieu de dupliquer la forme des
  // données à deux endroits.
  socket.on("maintenance", () => {
    getMainWindow()?.webContents.send("status:refresh");
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
