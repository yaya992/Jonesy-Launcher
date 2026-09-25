import { useEffect, useState } from "react";

export default function Credits() {
  const [credits, setCredits] = useState(undefined);

  useEffect(() => {
    window.launcher.content.credits().then(setCredits);
  }, []);

  return (
    <div className="p-7 overflow-y-auto h-full max-w-lg">
      <h1 className="text-lg font-bold text-slate-100">Équipe</h1>
      <p className="text-xs text-slate-500 mt-0.5 mb-5">Les gens derrière le projet.</p>

      {credits === undefined && <p className="text-xs text-slate-500">Chargement…</p>}

      {credits?.length === 0 && (
        <div className="rounded-xl bg-base-900 border border-white/[0.05] px-5 py-8 text-center">
          <span className="material-symbols-rounded !text-[28px] text-slate-600">groups</span>
          <p className="text-xs text-slate-500 mt-2">Aucun membre pour le moment.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {credits?.map((c) => (
          <div
            key={c.id}
            className="rounded-xl bg-base-900 border border-white/[0.05] p-4 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-400 to-flux-500 grid place-items-center text-xs font-bold text-white shrink-0">
              {c.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">{c.name}</p>
              <p className="text-[11px] text-slate-500 truncate">{c.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
