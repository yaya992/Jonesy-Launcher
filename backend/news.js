const fs = require("fs");
const path = require("path");

const NEWS_PATH = path.join(__dirname, "news.json");

const DEFAULT_NEWS = [
  {
    id: "welcome",
    title: "Bienvenue sur le launcher",
    date: new Date().toISOString().slice(0, 10),
    body: "Ceci est un exemple d'actualité, modifiable depuis le panel admin (`/admin`) ou directement dans `backend/news.json`.\n\n- Markdown supporté (listes, **gras**, liens…)\n- La plus récente s'affiche en premier sur la page Home du launcher",
  },
];

function loadNews() {
  if (!fs.existsSync(NEWS_PATH)) {
    fs.writeFileSync(NEWS_PATH, JSON.stringify(DEFAULT_NEWS, null, 2));
  }
  try {
    const news = JSON.parse(fs.readFileSync(NEWS_PATH, "utf-8"));
    return [...news].sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch {
    console.warn(`[backend-dev] news.json invalide, actualités par défaut utilisées.`);
    return DEFAULT_NEWS;
  }
}

function saveNews(news) {
  fs.writeFileSync(NEWS_PATH, JSON.stringify(news, null, 2));
}

module.exports = { loadNews, saveNews };
