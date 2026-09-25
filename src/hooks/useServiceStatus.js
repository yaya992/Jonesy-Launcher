import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 60_000;

/**
 * Interroge l'état du service (maintenance + modules activés) au montage
 * puis toutes les minutes, pour que le launcher réagisse à un changement
 * côté backend sans que le joueur ait à le redémarrer.
 */
export function useServiceStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const result = await window.launcher.status.get();
      if (!cancelled) setStatus(result);
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return {
    maintenance: status?.maintenance ?? null,
    isUnderMaintenance: Boolean(status?.maintenance?.enabled),
    // Les téléchargements peuvent rester ouverts pendant une maintenance,
    // pour laisser les joueurs préparer la mise à jour.
    canDownload: !status?.maintenance?.enabled || status?.maintenance?.allowDownloads,
    // {} tant que le statut n'est pas encore arrivé : tous les modules sont
    // alors considérés désactivés, plutôt que d'afficher puis faire
    // disparaître leur icône une fois la réponse reçue.
    enabledModules: status?.modules ?? {},
  };
}
