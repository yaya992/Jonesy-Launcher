import { useEffect, useState } from "react";
import { useGame } from "../../hooks/useGame";
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
  let primaryLabel = "Jouer";
  let primaryIcon = "play_arrow";
  let isBlocked = false;

  if (!installed) {
    primaryAction = install;
    primaryLabel = "Télécharger";
    primaryIcon = "download";
    isBlocked = !canDownload;
  } else if (!upToDate) {
    primaryAction = install;
    primaryLabel = "Mettre à jour";
    primaryIcon = "update";
    isBlocked = !canDownload;
  } else {
    // Le jeu est prêt, mais on ne lance rien pendant une maintenance.
    isBlocked = underMaintenance;
  }

  if (isBlocked) {
    primaryLabel = "Indisponible";
    primaryIcon = "lock";
  } else if (running) {
    primaryLabel = "En cours";
    primaryIcon = "sports_esports";
  }

  return (
    <div className="h-full relative overflow-hidden">
      {/* Hero : dégradé de marque en fond de scène, pas d'image externe requise */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_15%_0%,#1b1f33_0%,#0b0c11_58%)]" />
      <div className="absolute inset-0 bg-gradient-to-t from-base-950 via-base-950/40 to-transparent" />

      <div className="relative z-10 h-full flex flex-col justify-end px-9 pb-8">
        <p className="text-[11px] font-semibold text-flux-400 tracking-wide mb-1.5">
          {status?.displayVersion ? `Version ${status.displayVersion}` : "Saison en cours"}
        </p>
        <h1 className="text-[32px] font-bold tracking-tight leading-none mb-2 text-slate-50">
          {status?.name ?? "Bienvenue de retour"}
        </h1>
        <p className="text-sm text-slate-400 max-w-sm mb-5">
          {underMaintenance
            ? "Le jeu est momentanément indisponible."
            : installed
              ? upToDate
                ? "Ton jeu est prêt."
                : "Une mise à jour est disponible."
              : "Le jeu n'est pas encore installé sur cet appareil."}
        </p>

        {hardware && !hardware.meets && !underMaintenance && (
          <div className="mb-5 max-w-md rounded-lg border border-amber-400/20 bg-amber-400/10 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
              <span className="material-symbols-rounded !text-[14px]">warning</span>
              Configuration en dessous des recommandations
            </p>
            {hardware.warnings.map((warning) => (
              <p key={warning} className="text-[11px] text-amber-400/80">
                {warning}
              </p>
            ))}
            <p className="text-[10px] text-slate-500 mt-1">
              Tu peux quand même jouer, mais les performances risquent d'être limitées.
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
                className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-rounded !text-[16px]">grid_view</span>
                Library
              </button>
            )}
            {onGoToNews && (
              <button
                onClick={onGoToNews}
                className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-rounded !text-[16px]">feed</span>
                Actualités
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
              title={isBlocked ? maintenance?.message || "Indisponible pendant la maintenance" : undefined}
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-accent-500 to-flux-500 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm text-white shadow-glow transition-all"
            >
              {running ? (
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              ) : (
                <span className="material-symbols-rounded !text-[19px]">{primaryIcon}</span>
              )}
              {downloading ? "Téléchargement…" : primaryLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
