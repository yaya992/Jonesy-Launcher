import { useCallback, useEffect, useState } from "react";

/**
 * Suit si des actualités non lues existent, pour la pastille de la sidebar.
 *
 * On mémorise l'identifiant de l'actu la plus récente au moment où la page
 * News est ouverte, via les préférences persistées (electron-store), comme
 * le reste des réglages du launcher. Tant qu'une actu plus récente arrive,
 * la pastille réapparaît.
 *
 * Les news étant déjà triées du plus récent au plus ancien côté backend,
 * comparer le premier identifiant suffit — pas besoin de garder la liste de
 * tout ce qui a été lu.
 */
export function useUnreadNews() {
  const [latestId, setLatestId] = useState(null);
  const [lastReadId, setLastReadId] = useState(undefined); // undefined = pas encore chargé

  useEffect(() => {
    window.launcher.news.list().then((news) => {
      setLatestId(news?.length ? String(news[0].id) : null);
    });
    window.launcher.settings.get().then((settings) => {
      setLastReadId(settings?.preferences?.lastReadNewsId ?? null);
    });
  }, []);

  const markAsRead = useCallback(async () => {
    if (!latestId || latestId === lastReadId) return;
    setLastReadId(latestId);
    await window.launcher.settings.setPreference("lastReadNewsId", latestId);
  }, [latestId, lastReadId]);

  return {
    // On attend d'avoir les deux valeurs avant d'allumer la pastille, sinon
    // elle clignote au démarrage le temps que les préférences arrivent.
    hasUnreadNews: Boolean(latestId) && lastReadId !== undefined && latestId !== lastReadId,
    markAsRead,
  };
}
