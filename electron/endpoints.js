const { getConfig } = require("./config");

/**
 * Une seule URL à régler dans config.json (`server.url`) : celle du backend.
 * Tous les endpoints en découlent ici, au même endroit — au lieu d'avoir
 * une clé de config séparée par fonctionnalité (authUrl, newsUrl, faqUrl…),
 * qui devenait redondante et à mettre à jour à chaque nouveau module.
 *
 * Si ton backend a une structure de routes différente, c'est ici et
 * seulement ici qu'il faut l'adapter.
 */
function getEndpoints() {
  const base = getConfig().server.url.replace(/\/+$/, ""); // retire un éventuel slash final
  const launcher = `${base}/launcher`;

  return {
    base,
    login: `${launcher}/login`,
    manifest: `${launcher}/manifest.json`,
    status: `${launcher}/status`,
    news: `${launcher}/news`,
    faq: `${launcher}/faq`,
    socials: `${launcher}/socials`,
    serverStatus: `${launcher}/server-status`,
    credits: `${launcher}/credits`,
  };
}

module.exports = { getEndpoints };
