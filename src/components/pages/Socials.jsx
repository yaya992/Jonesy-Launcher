import { useEffect, useState } from "react";

export default function Socials() {
  const [socials, setSocials] = useState(undefined); // undefined = chargement

  useEffect(() => {
    window.launcher.content.socials().then(setSocials);
  }, []);

  return (
    <div className="p-7 overflow-y-auto h-full max-w-lg">
      <h1 className="text-lg font-bold text-ink-100">Réseaux sociaux</h1>
      <p className="text-xs text-ink-500 mt-0.5 mb-5">Retrouve-nous ailleurs.</p>

      {socials === undefined && <p className="text-xs text-ink-500">Chargement…</p>}

      {socials?.length === 0 && (
        <div className="rounded-xl bg-base-900 border border-tint/[0.05] px-5 py-8 text-center">
          <span className="material-symbols-rounded !text-[28px] text-ink-600">share</span>
          <p className="text-xs text-ink-500 mt-2">Aucun lien pour le moment.</p>
        </div>
      )}

      <div className="space-y-2">
        {socials
          ?.filter((s) => s.url)
          .map((s) => (
            <button
              key={s.id}
              onClick={() => window.launcher.shell.openExternal(s.url)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-base-900 border border-tint/[0.05] hover:border-accent-400/40 transition-colors text-left"
            >
              <span className="flex items-center gap-3">
                <span className="material-symbols-rounded !text-[20px] text-flux-400">
                  {s.icon || "link"}
                </span>
                <span className="text-sm font-medium text-ink-200">{s.label}</span>
              </span>
              <span className="material-symbols-rounded !text-[16px] text-ink-500">
                open_in_new
              </span>
            </button>
          ))}
      </div>
    </div>
  );
}
