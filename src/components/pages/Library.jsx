import { useEffect, useState } from "react";
import LibraryItem from "../LibraryItem";
import { useLanguage } from "../../context/LanguageContext";

export default function Library({ maintenance, canDownload }) {
  const { t } = useLanguage();
  const [games, setGames] = useState(null);

  useEffect(() => {
    window.launcher.library.list().then(setGames);
  }, []);

  return (
    <div className="p-7 overflow-y-auto h-full">
      <h1 className="text-lg font-bold text-ink-100">{t("library.title")}</h1>
      <p className="text-xs text-ink-500 mt-0.5 mb-5">
        {t("library.subtitle")}
      </p>

      {!games && <p className="text-xs text-ink-500">{t("library.loadingCatalog")}</p>}
      {games?.length === 0 && (
        <p className="text-xs text-ink-500">{t("library.empty")}</p>
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
