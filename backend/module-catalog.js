const { isTwitchLive } = require("./twitch-status");

/**
 * Catalogue des modules que le backend sait proposer, indépendamment de
 * l'état choisi par l'admin (ça, c'est dans game_config.json → modules).
 *
 * Le panel admin lit ce catalogue pour générer la page "Modules" (liste +
 * interrupteurs) et une page dédiée par module ACTIVÉ (paramètres +
 * éventuel éditeur de contenu) — rien à coder à la main côté admin.
 *
 * `params` : réglages du module. Ceux listés dans `publicParams` sont
 * renvoyés au launcher via /launcher/status (ex: l'URL d'un salon Discord,
 * dont le launcher a besoin pour afficher un bouton) ; les autres restent
 * internes au backend (ex: `maxPosts`, qui ne sert qu'à découper la liste
 * avant de répondre — le launcher n'a pas besoin de connaître ce réglage).
 *
 * `contentEditor` : si présent, le panel affiche un éditeur de contenu dédié
 * sur la page du module ("news" → liste d'articles, "faq" → un seul bloc
 * markdown, "socials"/"credits" → listes structurées), au lieu de se
 * limiter aux champs de `params`.
 *
 * `liveDataProvider` : fonction optionnelle appelée à chaque requête
 * /launcher/status, dont le résultat est fusionné dans les données
 * publiques du module — pour de la donnée calculée à la volée plutôt que
 * réglée par l'admin (ex: "la chaîne est-elle en direct maintenant ?").
 * N'apparaît jamais dans /admin/api/modules/catalog (une fonction ne
 * survit pas à un JSON.stringify), donc rien à filtrer côté admin.
 *
 * Pour ajouter un module :
 *  1. Une entrée ici (id, nom, description, params éventuels)
 *  2. Une valeur par défaut dans game-config.js → DEFAULT_CONFIG.modules
 *  3. La logique du module côté server.js (une route, un comportement…)
 *  4. Le module correspondant côté launcher (src/modules/registry.js)
 */
const MODULE_CATALOG = [
  {
    id: "news",
    name: "Actualités",
    description:
      "Affiche les actualités du jeu dans une page dédiée du launcher, avec une pastille quand il y en a de nouvelles.",
    icon: "feed",
    params: [
      {
        key: "maxPosts",
        label: "Nombre d'actualités affichées",
        type: "number",
        min: 1,
        max: 50,
        default: 5,
      },
    ],
    contentEditor: "news",
  },
  {
    id: "discord",
    name: "Discord",
    description:
      "Ajoute un bouton dans le launcher qui ouvre votre serveur Discord dans le navigateur.",
    icon: "forum",
    params: [
      {
        key: "inviteUrl",
        label: "Lien d'invitation",
        type: "text",
        placeholder: "https://discord.gg/...",
        default: "",
      },
    ],
    // Le launcher a besoin de l'URL pour savoir où ouvrir le bouton.
    publicParams: ["inviteUrl"],
  },
  {
    id: "faq",
    name: "FAQ",
    description: "Page de questions/réponses statique, éditable en markdown depuis ce panel.",
    icon: "help",
    contentEditor: "faq",
  },
  {
    id: "socials",
    name: "Réseaux sociaux",
    description:
      "Page listant vos réseaux (Twitter/X, YouTube, site web…), chaque lien s'ouvrant dans le navigateur.",
    icon: "share",
    contentEditor: "socials",
  },
  {
    id: "serverStatus",
    name: "Statut serveur",
    description:
      "Affiche en direct si le serveur de jeu est en ligne et le nombre de joueurs connectés. Pas de contenu à éditer : la donnée vient de votre backend de jeu.",
    icon: "dns",
    // Pas de `params` ni de `contentEditor` : ce module n'a qu'un interrupteur
    // marche/arrêt, tout le reste est de la donnée live (voir server.js →
    // /launcher/server-status, à brancher sur ton vrai serveur de jeu).
  },
  {
    id: "twitch",
    name: "Twitch",
    description:
      "Ajoute un bouton dans le launcher vers ta chaîne Twitch, avec une pastille quand tu es en direct.",
    icon: "live_tv",
    params: [
      {
        key: "channelUrl",
        label: "URL de la chaîne",
        type: "text",
        placeholder: "https://twitch.tv/...",
        default: "",
      },
    ],
    // channelUrl vient de la config (réglé par l'admin) ; `live` est
    // recalculé à chaque appel via liveDataProvider (voir plus bas) —
    // les deux se retrouvent fusionnés dans le même objet publicData.
    publicParams: ["channelUrl"],
    liveDataProvider: () => ({ live: isTwitchLive() }),
  },
  {
    id: "credits",
    name: "Équipe",
    description: "Page listant les membres de l'équipe et leur rôle.",
    icon: "groups",
    contentEditor: "credits",
  },
];

module.exports = { MODULE_CATALOG };
