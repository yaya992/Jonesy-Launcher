import { useEffect, useState } from "react";
import { useGame } from "../../hooks/useGame";
import { useLanguage } from "../../context/LanguageContext";
import ProgressBar from "../ProgressBar";

export default function Home({
  gameId,
  onGoToLibrary,
  onGoToNews,
  hasUnreadNews,
  isMultiGame,
  maintenance,
  canDownload,
}) {
  const { t } = useLanguage();
  const { status, progress, busy, running, error, install, launch } = useGame(gameId);
  const [hardware, setHardware] = useState(null);

  // Vérifie la config machine face aux prérequis du jeu (purement indicatif,
  // ne bloque jamais le lancement).
  useEffect(() => {
    if (!status?.requirements) return;
    window.launcher.system.checkRequirements(status.requirements).then(setHardware);
  }, [status?.requirements]);

  const installed = status?.installed;
  const upToDate = status?.upToDate;
  const downloading = busy && progress?.phase !== "verify";
  const underMaintenance = Boolean(maintenance?.enabled);

  let primaryAction = launch;
  let primaryLabel = t("home.play");
  let primaryIcon = "play_arrow";
  let isBlocked = false;

  if (!installed) {
    primaryAction = install;
    primaryLabel = t("home.download");
    primaryIcon = "download";
    isBlocked = !canDownload;
  } else if (!upToDate) {
    primaryAction = install;
    primaryLabel = t("home.update");
    primaryIcon = "update";
    isBlocked = !canDownload;
  } else {
    // Le jeu est prêt, mais on ne lance rien pendant une maintenance.
    isBlocked = underMaintenance;
  }

  if (isBlocked) {
    primaryLabel = t("home.unavailable");
    primaryIcon = "lock";
  } else if (running) {
    primaryLabel = t("home.running");
    primaryIcon = "sports_esports";
  }

  return (
    <div className="h-full relative overflow-hidden">
      {/* Hero : dégradé de marque en fond de scène, pas d'image externe requise */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_15%_0%,#1b1f33_0%,#0b0c11_58%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-base-950 via-base-950/40 to-transparent" />

      <div className="relative z-10 h-full flex flex-col justify-end px-9 pb-8">
        <p className="text-[11px] font-semibold text-flux-400 tracking-wide mb-1.5">
          {status?.displayVersion ? t("home.versionLabel", { version: status.displayVersion }) : t("home.currentSeason")}
        </p>
        <h1 className="text-[32px] font-bold tracking-tight leading-none mb-2 text-ink-100">
          {status?.name ?? t("home.welcomeBack")}
        </h1>
        <p className="text-sm text-ink-400 max-w-sm mb-5">
          {underMaintenance
            ? t("home.maintenanceUnavailable")
            : installed
              ? upToDate
                ? t("home.ready")
                : t("home.updateAvailable")
              : t("home.notInstalled")}
        </p>

        {hardware && !hardware.meets && !underMaintenance && (
          <div className="mb-5 max-w-md rounded-lg border border-amber-400/20 bg-amber-400/10 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
              <span className="material-symbols-rounded !text-[14px]">warning</span>
              {t("home.belowRecommended")}
            </p>
            {hardware.warnings.map((warning) => (
              <p key={warning} className="text-[11px] text-amber-400/80">
                {warning}
              </p>
            ))}
            <p className="text-[10px] text-ink-500 mt-1">
              {t("home.canStillPlay")}
            </p>
          </div>
        )}

        {error && error !== "MAINTENANCE" && (
          <p className="text-xs text-red-400 mb-3">{error}</p>
        )}

        <div className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            {isMultiGame && (
              <button
                onClick={onGoToLibrary}
                className="text-xs font-medium text-ink-400 hover:text-ink-200 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-rounded !text-[16px]">grid_view</span>
                {t("home.library")}
              </button>
            )}
            {onGoToNews && (
              <button
                onClick={onGoToNews}
                className="text-xs font-medium text-ink-400 hover:text-ink-200 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-rounded !text-[16px]">feed</span>
                {t("home.news")}
                {hasUnreadNews && <span className="w-1.5 h-1.5 rounded-full bg-flux-500" />}
              </button>
            )}
          </div>

          <div className="flex flex-col items-end gap-2.5">
            {downloading && (
              <div className="w-56">
                <ProgressBar progress={progress} compact />
              </div>
            )}
            <button
              onClick={primaryAction}
              disabled={downloading || !gameId || isBlocked || running}
              title={isBlocked ? maintenance?.message || t("home.unavailableDuringMaintenance") : undefined}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-accent-500 to-flux-500 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm text-white shadow-glow transition-all"
            >
              {running ? (
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              ) : (
                <span className="material-symbols-rounded !text-[19px]">{primaryIcon}</span>
              )}
              {downloading ? t("home.downloading") : primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
