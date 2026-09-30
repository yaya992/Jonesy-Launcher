import { useEffect, useState } from "react";
import { renderMarkdown } from "../../lib/markdown";
import { useLanguage } from "../../context/LanguageContext";

export default function News() {
  const { t } = useLanguage();
  const [news, setNews] = useState(null);

  useEffect(() => {
    window.launcher.news.list().then(setNews);
  }, []);

  return (
    <div className="p-7 overflow-y-auto h-full max-w-2xl">
      <h1 className="text-lg font-bold text-ink-100">{t("pages.news.title")}</h1>
      <p className="text-xs text-ink-500 mt-0.5 mb-5">
        {t("pages.news.subtitle")}
      </p>

      {!news && <p className="text-xs text-ink-500">{t("common.loading")}</p>}

      {news?.length === 0 && (
        <div className="rounded-xl bg-base-900 border border-tint/[0.05] px-5 py-8 text-center">
          <span className="material-symbols-rounded !text-[28px] text-ink-600">feed</span>
          <p className="text-xs text-ink-500 mt-2">{t("pages.news.empty")}</p>
        </div>
      )}

      <div className="space-y-3">
        {news?.map((post) => (
          <article
            key={post.id}
            className="rounded-xl bg-base-900 border border-tint/[0.05] p-5"
          >
            <p className="text-[10px] text-flux-400 font-semibold mb-1">{post.date}</p>
            <h2 className="text-base font-semibold text-ink-100 mb-2.5 leading-snug">
              {post.title}
            </h2>
            <div
              className="text-xs text-ink-400 leading-relaxed space-y-1.5"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(post.body) }}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
