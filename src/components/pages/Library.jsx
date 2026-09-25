import { useEffect, useState } from "react";
import LibraryItem from "../LibraryItem";

export default function Library({ maintenance, canDownload }) {
  const [games, setGames] = useState(null);

  useEffect(() => {
    window.launcher.library.list().then(setGames);
  }, []);

  return (
    <div className="p-7 overflow-y-auto h-full">
      <h1 className="text-lg font-bold text-ink-100">Library</h1>
      <p className="text-xs text-ink-500 mt-0.5 mb-5">
        Installe, vérifie ou répare tes saisons et contenus.
      </p>

      {!games && <p className="text-xs text-ink-500">Chargement du catalogue…</p>}
      {games?.length === 0 && (
        <p className="text-xs text-ink-500">Aucun contenu disponible pour le moment.</p>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3.5">
        {games?.map((game) => (
          <LibraryItem
            key={game.id}
            game={game}
            maintenance={maintenance}
            canDownload={canDownload}
          />
        ))}
      </div>
    </div>
  );
}
