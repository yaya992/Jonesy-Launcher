import { useLanguage } from "../context/LanguageContext";

export default function UpdateBanner({ status, version, restartAndInstall }) {
  const { t } = useLanguage();
  if (status !== "downloaded") return null;

  return (
    <div className="shrink-0 bg-flux-500/10 border-b border-flux-500/20 px-5 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="material-symbols-rounded !text-[16px] text-flux-400 shrink-0">
          system_update
        </span>
        <p className="text-xs text-flux-400 truncate">
          {t("updateBanner.readyMessage", { version: version ? `v${version} ` : "" })}
        </p>
      </div>
      <button
        onClick={restartAndInstall}
        className="shrink-0 text-xs font-semibold text-flux-400 hover:text-flux-300 underline"
      >
        {t("updateBanner.restartNow")}
      </button>
    </div>
  );
}
