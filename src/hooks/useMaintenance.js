import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 60_000;

/**
 * Interroge l'état de maintenance au montage puis toutes les minutes, pour
 * que le launcher réagisse à une ouverture/fermeture du service sans que le
 * joueur ait à le redémarrer.
 */
export function useMaintenance() {
  const [maintenance, setMaintenance] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const result = await window.launcher.status.maintenance();
      if (!cancelled) setMaintenance(result);
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return {
    maintenance,
    isUnderMaintenance: Boolean(maintenance?.enabled),
    // Les téléchargements peuvent rester ouverts pendant une maintenance,
    // pour laisser les joueurs préparer la mise à jour.
    canDownload: !maintenance?.enabled || maintenance?.allowDownloads,
  };
}
