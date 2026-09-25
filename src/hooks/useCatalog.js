import { useEffect, useState } from "react";

/**
 * Charge le catalogue une seule fois et expose le "jeu principal"
 * (le premier du manifest) ainsi que le nombre total de jeux.
 *
 * Tant qu'il n'y a qu'un seul jeu, l'interface reste centrée sur lui : la
 * page Library n'apporterait rien et est masquée. Elle réapparaît
 * automatiquement dès qu'une deuxième saison est ajoutée côté backend,
 * sans changement de code.
 */
export function useCatalog() {
  const [games, setGames] = useState(null);

  useEffect(() => {
    window.launcher.library.list().then((list) => setGames(list || []));
  }, []);

  return {
    games,
    mainGame: games?.[0] ?? null,
    mainGameId: games?.[0]?.id ?? null,
    isMultiGame: (games?.length ?? 0) > 1,
    loading: games === null,
  };
}
