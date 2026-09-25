/**
 * Rendu markdown volontairement minimal (gras, italique, code, listes,
 * liens, titres) — suffisant pour des changelogs et des actualités courtes,
 * sans tirer une dépendance de plus dans le bundle.
 *
 * Le texte est échappé AVANT toute transformation, donc du HTML présent dans
 * une actualité rédigée côté backend s'affiche littéralement au lieu d'être
 * interprété (pas d'injection possible via le panel admin).
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderMarkdown(source = "") {
  const lines = escapeHtml(source).split("\n");
  const html = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      continue;
    }

    const listMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      if (!inList) {
        html.push('<ul class="list-disc pl-4 space-y-0.5">');
        inList = true;
      }
      html.push(`<li>${inline(listMatch[1])}</li>`);
      continue;
    }

    closeList();

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const size = level === 1 ? "text-sm" : "text-[13px]";
      html.push(`<p class="${size} font-semibold text-ink-200 mt-2">${inline(headingMatch[2])}</p>`);
      continue;
    }

    html.push(`<p>${inline(trimmed)}</p>`);
  }

  closeList();
  return html.join("");
}

function inline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-ink-200">$1</strong>')
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-tint/[0.08] text-[11px]">$1</code>')
    .replace(
      /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer" class="text-flux-400 hover:underline">$1</a>'
    );
}
