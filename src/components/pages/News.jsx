import { useEffect, useState } from "react";
import { renderMarkdown } from "../../lib/markdown";

export default function News() {
  const [news, setNews] = useState(null);

  useEffect(() => {
    window.launcher.news.list().then(setNews);
  }, []);

  return (
    <div className="p-7 overflow-y-auto h-full max-w-2xl">
      <h1 className="text-lg font-bold text-slate-100">Actualités</h1>
      <p className="text-xs text-slate-500 mt-0.5 mb-5">
        Les dernières nouvelles du jeu et du serveur.
      </p>

      {!news && <p className="text-xs text-slate-500">Chargement…</p>}

      {news?.length === 0 && (
        <div className="rounded-xl bg-base-900 border border-white/[0.05] px-5 py-8 text-center">
          <span className="material-symbols-rounded !text-[28px] text-slate-600">feed</span>
          <p className="text-xs text-slate-500 mt-2">Aucune actualité pour le moment.</p>
        </div>
      )}

      <div className="space-y-3">
        {news?.map((post) => (
          <article
            key={post.id}
            className="rounded-xl bg-base-900 border border-white/[0.05] p-5"
          >
            <p className="text-[10px] text-flux-400 font-semibold mb-1">{post.date}</p>
            <h2 className="text-base font-semibold text-slate-100 mb-2.5 leading-snug">
              {post.title}
            </h2>
            <div
              className="text-xs text-slate-400 leading-relaxed space-y-1.5"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
