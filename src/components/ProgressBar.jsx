import { useLanguage } from "../context/LanguageContext";

function formatBytes(t, bytes = 0) {
  if (!bytes) return `0 ${t("common.mo")}`;
  const mb = bytes / (1024 * 1024);
  if (mb > 1024) return `${(mb / 1024).toFixed(2)} ${t("common.go")}`;
  return `${mb.toFixed(1)} ${t("common.mo")}`;
}

function formatSpeed(t, bytesPerSecond = 0) {
  if (!bytesPerSecond) return null;
  return `${formatBytes(t, bytesPerSecond)}/s`;
}

function formatEta(seconds) {
  if (seconds == null) return null;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remSeconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default function ProgressBar({ progress, compact = false }) {
  const { t } = useLanguage();
  if (!progress) return null;
  const percent = progress.percent ?? 0;

  const speed = formatSpeed(t, progress.bytesPerSecond);
  const eta = formatEta(progress.etaSeconds);

  const label =
    progress.phase === "verify"
      ? t("progressBar.verifyProgress", { current: progress.current, total: progress.total })
      : `${formatBytes(t, progress.bytesDownloaded)} / ${formatBytes(t, progress.totalBytes)}`;

  const detail = [speed, eta && t("progressBar.remaining", { eta })].filter(Boolean).join(" · ");

  return (
    <div className="w-full">
      <div
        className={`flex justify-between text-ink-400 mb-1 ${
          compact ? "text-[10px]" : "text-xs"
        }`}
      >
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className={`rounded-full bg-tint/[0.06] overflow-hidden ${compact ? "h-1" : "h-1.5"}`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-500 to-flux-500 transition-all duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>
      {detail && <p className={`text-ink-500 mt-1 ${compact ? "text-[9px]" : "text-[11px]"}`}>{detail}</p>}
    </div>
  );
}
