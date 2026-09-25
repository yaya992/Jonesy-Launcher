const fs = require("fs");
const path = require("path");

const FAQ_PATH = path.join(__dirname, "faq.json");

const DEFAULT_FAQ = {
  body: "## Comment je réinstalle le jeu ?\n\nDepuis la Home du launcher, clique sur *Réparer* si le jeu est déjà installé, ou *Télécharger* sinon.\n\n## Le launcher ne se connecte pas, que faire ?\n\nVérifie ta connexion internet, puis réessaie. Si le problème persiste, rejoins le Discord.",
};

function loadFaq() {
  if (!fs.existsSync(FAQ_PATH)) {
    fs.writeFileSync(FAQ_PATH, JSON.stringify(DEFAULT_FAQ, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(FAQ_PATH, "utf-8"));
  } catch {
    console.warn(`[backend-dev] faq.json invalide, contenu par défaut utilisé.`);
    return DEFAULT_FAQ;
  }
}

function saveFaq(faq) {
  fs.writeFileSync(FAQ_PATH, JSON.stringify(faq, null, 2));
}

module.exports = { loadFaq, saveFaq };
