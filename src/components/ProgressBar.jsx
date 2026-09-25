function formatBytes(bytes = 0) {
  if (!bytes) return "0 Mo";
  const mb = bytes / (1024 * 1024);
  if (mb > 1024) return `${(mb / 1024).toFixed(2)} Go`;
  return `${mb.toFixed(1)} Mo`;
}

function formatSpeed(bytesPerSecond = 0) {
  if (!bytesPerSecond) return null;
  return `${formatBytes(bytesPerSecond)}/s`;
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
  if (!progress) return null;
  const percent = progress.percent ?? 0;

  const speed = formatSpeed(progress.bytesPerSecond);
  const eta = formatEta(progress.etaSeconds);

  const label =
    progress.phase === "verify"
      ? `Vérification ${progress.current}/${progress.total}`
      : `${formatBytes(progress.bytesDownloaded)} / ${formatBytes(progress.totalBytes)}`;

  const detail = [speed, eta && `${eta} restant`].filter(Boolean).join(" · ");

  return (
    <div className="w-full">
      <div
        className={`flex justify-between text-slate-400 mb-1 ${
          compact ? "text-[10px]" : "text-xs"
        }`}
      >
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className={`rounded-full bg-white/[0.06] overflow-hidden ${compact ? "h-1" : "h-1.5"}`}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-500 to-flux-500 transition-all duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>
      {detail && <p className={`text-slate-500 mt-1 ${compact ? "text-[9px]" : "text-[11px]"}`}>{detail}</p>}
    </div>
  );
}
