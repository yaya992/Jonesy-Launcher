import { useState } from "react";
import { useGame } from "../hooks/useGame";
import ProgressBar from "./ProgressBar";
import { renderMarkdown } from "../lib/markdown";

export default function LibraryItem({ game, maintenance, canDownload = true }) {
  const { status, progress, busy, running, error, install, repair, verify, cancel, launch } =
    useGame(game.id);
  const [verifyResult, setVerifyResult] = useState(null);
  const [showChangelog, setShowChangelog] = useState(false);

  const installed = status?.installed;
  const upToDate = status?.upToDate;
  const isWorking = busy;
  const changelog = status?.changelog || game.changelog;
  const underMaintenance = Boolean(maintenance?.enabled);

  const handleVerify = async () => {
    setVerifyResult(null);
    const result = await verify();
    if (result) setVerifyResult(result);
  };

  return (
    <div className="rounded-xl bg-base-900 border border-tint/[0.05] overflow-hidden flex flex-col">
      {/* Vignette : dégradé de marque, pas d'asset externe nécessaire */}
      <div className="h-20 bg-[linear-gradient(135deg,#1c1f33_0%,#141620_100%)] relative">
        <div className="absolute inset-0 bg-gradient-to-t from-base-900 to-transparent" />
        <span
          className={`absolute top-2.5 right-2.5 material-symbols-rounded !text-[18px] ${
            installed ? "text-flux-400" : "text-ink-600"
          }`}
        >
          {installed ? "check_circle" : "cloud_off"}
        </span>
      </div>

      <div className="p-3.5 flex flex-col gap-2.5 flex-1">
        <div>
          <h3 className="text-sm font-semibold text-ink-100 truncate">{game.name}</h3>
          <p className="text-[11px] text-ink-500 mt-0.5">
            v{status?.displayVersion ?? game.displayVersion ?? game.version}
            {installed && (
              <span className={upToDate ? "text-flux-400" : "text-amber-400"}>
                {" "}
                • {upToDate ? "À jour" : "Mise à jour dispo"}
              </span>
            )}
            {!installed && <span> • Non installé</span>}
          </p>
        </div>

        {changelog && (
          <div>
            <button
              onClick={() => setShowChangelog(!showChangelog)}
              className="text-[11px] text-ink-500 hover:text-ink-300 flex items-center gap-0.5 transition-colors"
            >
              <span className="material-symbols-rounded !text-[14px]">
                {showChangelog ? "expand_less" : "expand_more"}
              </span>
              Nouveautés
            </button>
            {showChangelog && (
              <div
                className="text-[11px] text-ink-400 leading-relaxed mt-1.5 pl-1 space-y-1"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(changelog) }}
              />
            )}
          </div>
        )}

        {isWorking && progress && <ProgressBar progress={progress} compact />}

        {verifyResult && (
          <p className={`text-[11px] ${verifyResult.healthy ? "text-flux-400" : "text-amber-400"}`}>
            {verifyResult.healthy
              ? "Fichiers intègres."
              : `${verifyResult.broken.length} fichier(s) à réparer.`}
          </p>
        )}

        {error && <p className="text-[11px] text-red-400">{error}</p>}

        <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
          {!installed && (
            <button
              onClick={install}
              disabled={isWorking || !canDownload}
              className="px-3 py-1.5 rounded-md bg-gradient-to-r from-accent-500 to-flux-500 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white flex items-center gap-1"
            >
              <span className="material-symbols-rounded !text-[14px]">download</span>
              Installer
            </button>
          )}

          {installed && !upToDate && (
            <button
              onClick={install}
              disabled={isWorking || !canDownload}
              className="px-3 py-1.5 rounded-md bg-gradient-to-r from-accent-500 to-flux-500 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white flex items-center gap-1"
            >
              <span className="material-symbols-rounded !text-[14px]">update</span>
              Mettre à jour
            </button>
          )}

          {installed && upToDate && (
            <button
              onClick={launch}
              disabled={underMaintenance || running}
              title={underMaintenance ? "Indisponible pendant la maintenance" : undefined}
              className="px-3 py-1.5 rounded-md bg-tint/[0.07] hover:bg-tint/[0.12] disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-ink-100 flex items-center gap-1"
            >
              {running ? (
                <span className="w-1.5 h-1.5 rounded-full bg-flux-400 animate-pulse" />
              ) : (
                <span className="material-symbols-rounded !text-[14px]">
                  {underMaintenance ? "lock" : "play_arrow"}
                </span>
              )}
              {running ? "En cours" : underMaintenance ? "Indisponible" : "Jouer"}
            </button>
          )}

          {installed && (
            <>
              <button
                onClick={handleVerify}
                disabled={isWorking}
                title="Vérifier"
                className="w-7 h-7 rounded-md hover:bg-tint/[0.06] disabled:opacity-50 grid place-items-center text-ink-400"
              >
                <span className="material-symbols-rounded !text-[16px]">fact_check</span>
              </button>
              <button
                onClick={repair}
                disabled={isWorking}
                title="Réparer"
                className="w-7 h-7 rounded-md hover:bg-tint/[0.06] disabled:opacity-50 grid place-items-center text-ink-400"
              >
                <span className="material-symbols-rounded !text-[16px]">build</span>
              </button>
            </>
          )}

          {isWorking && (
            <button
              onClick={cancel}
              title="Annuler"
              className="w-7 h-7 rounded-md hover:bg-red-500/10 grid place-items-center text-red-400"
            >
              <span className="material-symbols-rounded !text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
