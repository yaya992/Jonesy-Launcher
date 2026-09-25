import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * Encapsule tout le cycle de vie d'un jeu côté UI :
 * - statut (installé / à jour)
 * - progression de téléchargement / vérification en temps réel (IPC)
 * - actions install / verify / repair / cancel / launch
 */
export function useGame(gameId) {
  const { logout } = useAuth();
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(null); // { phase, percent, bytesDownloaded, totalBytes }
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false); // le jeu est lancé, en attente de sa fermeture
  const [error, setError] = useState(null);

  const refreshStatus = useCallback(async () => {
    if (!gameId) return;
    const s = await window.launcher.library.status(gameId);
    setStatus(s);
    return s;
  }, [gameId]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!gameId) return;
    const offDownload = window.launcher.library.onDownloadProgress((payload) => {
      if (payload.gameId !== gameId) return;
      setProgress(payload);
      if (payload.phase === "done") {
        setBusy(false);
        refreshStatus();
      }
      if (payload.phase === "cancelled") setBusy(false);
    });
    const offVerify = window.launcher.library.onVerifyProgress((payload) => {
      if (payload.gameId !== gameId) return;
      setProgress(payload);
    });
    return () => {
      offDownload();
      offVerify();
    };
  }, [gameId, refreshStatus]);

  useEffect(() => {
    if (!gameId) return;
    // Le hook repart de zéro à chaque montage (changer d'onglet démonte le
    // composant Home/LibraryItem) : il faut donc redemander l'état réel au
    // process principal — seul endroit qui sait si le jeu tourne encore —
    // plutôt que de supposer `false` par défaut.
    window.launcher.game.isRunning(gameId).then(setRunning);

    const offExited = window.launcher.game.onExited(({ gameId: exitedId }) => {
      if (exitedId === gameId) setRunning(false);
    });
    return offExited;
  }, [gameId]);

  const runAction = useCallback(
    async (action) => {
      setError(null);
      setBusy(true);
      try {
        await action();
      } catch (err) {
        setError(err.message || String(err));
        setBusy(false);
      }
    },
    []
  );

  const install = useCallback(
    () => runAction(() => window.launcher.library.install(gameId)),
    [gameId, runAction]
  );

  const repair = useCallback(
    () => runAction(() => window.launcher.library.repair(gameId)),
    [gameId, runAction]
  );

  const verify = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await window.launcher.library.verify(gameId);
      setBusy(false);
      return result;
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  }, [gameId]);

  const cancel = useCallback(async () => {
    await window.launcher.library.cancel(gameId);
  }, [gameId]);

  const launch = useCallback(async () => {
    setError(null);
    try {
      await window.launcher.game.launch(gameId);
      // Optimiste : le lancement a réussi côté launcher (UAC acceptée, process
      // démarré). "En cours" reste affiché jusqu'à ce que game:exited arrive.
      setRunning(true);
    } catch (err) {
      if (err.message === "SESSION_EXPIRED") {
        // Le mot de passe n'a pas pu être redéchiffré (autre machine, session
        // périmée…) : on déconnecte proprement plutôt que de laisser le
        // launcher bloqué sur un état "connecté" qui ne peut plus lancer le jeu.
        await logout("Ta session a expiré, reconnecte-toi pour lancer le jeu.");
      } else if (err.message === "MAINTENANCE") {
        // Le bandeau de maintenance explique déjà la situation en haut de
        // l'app : inutile de dupliquer un message d'erreur rouge ici.
        setError(null);
      } else {
        setError(err.message || String(err));
      }
    }
  }, [gameId, logout]);

  return {
    status,
    progress,
    busy,
    running,
    error,
    install,
    repair,
    verify,
    cancel,
    launch,
    refreshStatus,
  };
}
