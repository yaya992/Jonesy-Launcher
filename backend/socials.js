const fs = require("fs");
const path = require("path");

const SOCIALS_PATH = path.join(__dirname, "socials.json");

const DEFAULT_SOCIALS = [
  { id: "twitter", label: "Twitter / X", icon: "chat", url: "" },
  { id: "youtube", label: "YouTube", icon: "smart_display", url: "" },
  { id: "website", label: "Site web", icon: "language", url: "" },
];

function loadSocials() {
  if (!fs.existsSync(SOCIALS_PATH)) {
    fs.writeFileSync(SOCIALS_PATH, JSON.stringify(DEFAULT_SOCIALS, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(SOCIALS_PATH, "utf-8"));
  } catch {
    console.warn(`[backend-dev] socials.json invalide, valeurs par défaut utilisées.`);
    return DEFAULT_SOCIALS;
  }
}

function saveSocials(socials) {
  fs.writeFileSync(SOCIALS_PATH, JSON.stringify(socials, null, 2));
}

module.exports = { loadSocials, saveSocials };
