import { useEffect, useState } from "react";
import { useLanguage } from "../../context/LanguageContext";

const POLL_INTERVAL_MS = 15_000;

export default function ServerStatus() {
  const { t } = useLanguage();
  const [status, setStatus] = useState(undefined); // undefined = chargement, null = indisponible

  useEffect(() => {
    let cancelled = false;
    const check = () => window.launcher.content.serverStatus().then((s) => !cancelled && setStatus(s));
    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="p-7 overflow-y-auto h-full max-w-lg">
      <h1 className="text-lg font-bold text-ink-100">{t("pages.serverStatus.title")}</h1>
      <p className="text-xs text-ink-500 mt-0.5 mb-5">{t("pages.serverStatus.subtitle")}</p>

      {status === undefined && <p className="text-xs text-ink-500">{t("common.loading")}</p>}

      {status === null && (
        <div className="rounded-xl bg-base-900 border border-tint/[0.05] px-5 py-8 text-center">
          <span className="material-symbols-rounded !text-[28px] text-ink-600">dns</span>
          <p className="text-xs text-ink-500 mt-2">{t("pages.serverStatus.empty")}</p>
        </div>
      )}

      {status && (
        <div className="rounded-xl bg-base-900 border border-tint/[0.05] p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status.online ? "bg-flux-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm font-semibold text-ink-200">
              {status.online ? t("pages.serverStatus.online") : t("pages.serverStatus.offline")}
            </span>
          </div>

          {status.online && (
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-ink-100">{status.playerCount}</span>
                {status.maxPlayers != null && (
                  <span className="text-sm text-ink-500">/ {status.maxPlayers} {t("pages.serverStatus.players")}</span>
                )}
              </div>
              {status.maxPlayers > 0 && (
                <div className="h-1.5 rounded-full bg-tint/[0.06] overflow-hidden mt-3">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-500 to-flux-500"
                    style={{
                      width: `${Math.min(100, (status.playerCount / status.maxPlayers) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
