const fs = require("fs");
const path = require("path");

const CREDITS_PATH = path.join(__dirname, "credits.json");

const DEFAULT_CREDITS = [{ id: "1", name: "Ton pseudo", role: "Fondateur" }];

function loadCredits() {
  if (!fs.existsSync(CREDITS_PATH)) {
    fs.writeFileSync(CREDITS_PATH, JSON.stringify(DEFAULT_CREDITS, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(CREDITS_PATH, "utf-8"));
  } catch {
    console.warn(`[backend-dev] credits.json invalide, valeurs par défaut utilisées.`);
    return DEFAULT_CREDITS;
  }
}

function saveCredits(credits) {
  fs.writeFileSync(CREDITS_PATH, JSON.stringify(credits, null, 2));
}

module.exports = { loadCredits, saveCredits };
