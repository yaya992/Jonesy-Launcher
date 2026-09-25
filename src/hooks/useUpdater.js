import { useEffect, useState } from "react";

/**
 * Suit les événements de l'auto-updater (electron-updater côté main).
 * Un seul flux d'état, alimenté par les événements poussés depuis le
 * process principal — pas de polling ici, updater.js gère déjà son propre
 * rythme de vérification (démarrage + toutes les heures).
 */
export function useUpdater() {
  const [state, setState] = useState({ status: "idle" }); // idle|checking|available|downloading|downloaded|up-to-date|error

  useEffect(() => {
    const off = window.launcher.updater.onEvent((event) => {
      switch (event.type) {
        case "checking":
          setState({ status: "checking" });
          break;
        case "available":
          setState({ status: "available", version: event.version });
          break;
        case "downloading":
          setState({ status: "downloading", percent: event.percent });
          break;
        case "downloaded":
          setState({ status: "downloaded", version: event.version });
          break;
        case "up-to-date":
          setState({ status: "up-to-date" });
          break;
        case "error":
          setState({ status: "error", message: event.message });
          break;
        default:
          break;
      }
    });
    return off;
  }, []);

  const checkNow = () => window.launcher.updater.check();
  const restartAndInstall = () => window.launcher.updater.quitAndInstall();

  return { ...state, checkNow, restartAndInstall };
}
