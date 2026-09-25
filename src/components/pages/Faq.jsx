import { useEffect, useState } from "react";
import { renderMarkdown } from "../../lib/markdown";

export default function Faq() {
  const [faq, setFaq] = useState(undefined); // undefined = chargement, null = rien à afficher

  useEffect(() => {
    window.launcher.content.faq().then(setFaq);
  }, []);

  return (
    <div className="p-7 overflow-y-auto h-full max-w-2xl">
      <h1 className="text-lg font-bold text-slate-100">FAQ</h1>
      <p className="text-xs text-slate-500 mt-0.5 mb-5">Questions fréquentes.</p>

      {faq === undefined && <p className="text-xs text-slate-500">Chargement…</p>}

      {faq === null && (
        <div className="rounded-xl bg-base-900 border border-white/[0.05] px-5 py-8 text-center">
          <span className="material-symbols-rounded !text-[28px] text-slate-600">help</span>
          <p className="text-xs text-slate-500 mt-2">Aucune FAQ disponible pour le moment.</p>
        </div>
      )}

      {faq?.body && (
        <div
          className="rounded-xl bg-base-900 border border-white/[0.05] p-5 text-xs text-slate-400 leading-relaxed space-y-1.5"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(faq.body) }}
        />
      )}
    </div>
  );
}
