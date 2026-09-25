import News from "../components/pages/News";
import Faq from "../components/pages/Faq";
import Socials from "../components/pages/Socials";
import ServerStatus from "../components/pages/ServerStatus";
import Credits from "../components/pages/Credits";
import { useUnreadNews } from "../hooks/useUnreadNews";

/**
 * Un module = une fonctionnalité annexe, activable/désactivable côté
 * backend (game_config.json → modules) sans jamais toucher au code du
 * launcher : le joueur qui n'a pas la fonctionnalité active ne voit ni
 * l'icône dans la sidebar, ni la page.
 *
 * Deux types de module :
 *  - `type: "page"` (par défaut) — ajoute une page interne, avec un
 *    `Component` à afficher. C'est le cas de "news" et "faq".
 *  - `type: "link"` — le clic dans la sidebar ouvre une URL externe dans le
 *    navigateur au lieu de naviguer vers une page. L'URL vient de
 *    `publicData` (les params publics renvoyés par /launcher/status — voir
 *    `publicParams` dans backend/module-catalog.js). C'est le cas de "discord".
 *
 * Pour ajouter un module :
 *  1. Déclare-le dans backend/module-catalog.js (+ DEFAULT_CONFIG.modules)
 *  2. Ajoute une entrée ici avec le même `id`
 * Rien d'autre à modifier — Sidebar et App branchent la liste dynamiquement.
 *
 * `useBadge` (optionnel) doit renvoyer `{ active, onView }` :
 *  - `active`  : true tant qu'il y a quelque chose de "non vu" à signaler
 *  - `onView`  : appelé quand la page du module s'ouvre, pour éteindre le badge
 */
function useNewsBadge() {
  const { hasUnreadNews, markAsRead } = useUnreadNews();
  return { active: hasUnreadNews, onView: markAsRead };
}

export const MODULE_REGISTRY = [
  {
    id: "news",
    label: "Actualités",
    icon: "feed",
    type: "page",
    Component: News,
    useBadge: useNewsBadge,
  },
  {
    id: "faq",
    label: "FAQ",
    icon: "help",
    type: "page",
    Component: Faq,
  },
  {
    id: "discord",
    label: "Discord",
    icon: "forum",
    type: "link",
    // Généralise l'accès à l'URL : chaque module "link" peut nommer son
    // champ différemment côté backend (ici `inviteUrl`) sans que la Sidebar
    // ait besoin de connaître ce nom.
    getHref: (publicData) => publicData?.inviteUrl,
  },
  {
    id: "socials",
    label: "Réseaux",
    icon: "share",
    type: "page",
    Component: Socials,
  },
  {
    id: "serverStatus",
    label: "Statut",
    icon: "dns",
    type: "page",
    Component: ServerStatus,
  },
  {
    id: "twitch",
    label: "Twitch",
    icon: "live_tv",
    type: "link",
    getHref: (publicData) => publicData?.channelUrl,
    // Pastille pilotée par le backend (pas de useBadge : rien à "marquer
    // comme lu", elle s'éteint toute seule quand `live` repasse à false).
    getBadge: (publicData) => publicData?.live,
  },
  {
    id: "credits",
    label: "Équipe",
    icon: "groups",
    type: "page",
    Component: Credits,
  },
];
