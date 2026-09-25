export default function MaintenanceBanner({ maintenance }) {
  if (!maintenance?.enabled) return null;

  return (
    <div className="shrink-0 bg-amber-400/10 border-b border-amber-400/20 px-5 py-2.5 flex items-start gap-2.5">
      <span className="material-symbols-rounded !text-[16px] text-amber-400 mt-px shrink-0">
        construction
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-amber-400">Maintenance en cours</p>
        {maintenance.message && (
          <p className="text-[11px] text-amber-400/80 mt-0.5">{maintenance.message}</p>
        )}
        {maintenance.allowDownloads && (
          <p className="text-[10px] text-ink-500 mt-1">
            Les téléchargements et mises à jour restent disponibles.
          </p>
        )}
      </div>
    </div>
  );
}
