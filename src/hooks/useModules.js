import { MODULE_REGISTRY } from "../modules/registry";

/**
 * Résout les modules réellement actifs (registre ∩ flags backend), avec
 * leur état de badge s'ils en définissent un.
 *
 * Deux façons pour un module de piloter son badge :
 *  - `useBadge()` — état géré côté client (ex: "actu jamais lue", mémorisé
 *    dans les préférences). Reçoit `{ active, onView }`.
 *  - `getBadge(publicData)` — état calculé côté backend et renvoyé dans
 *    /launcher/status (ex: "la chaîne Twitch est en direct maintenant").
 *    Pas de `onView` : rien à "marquer comme lu", c'est un état qui vit ou
 *    meurt tout seul selon la donnée live.
 * Un module ne déclare que l'un des deux.
 *
 * Le hook de badge de CHAQUE module du registre est appelé, dans un ordre
 * fixe — le registre est une constante du bundle, pas une liste qui change
 * en cours de vie de l'app — ce qui respecte les règles des Hooks même si
 * certains de ces modules sont désactivés côté backend pour ce joueur.
 */
export function useModules(enabledModules) {
  const clientBadges = MODULE_REGISTRY.map((mod) => ({
    id: mod.id,
    badge: mod.useBadge ? mod.useBadge() : null,
  }));

  return MODULE_REGISTRY.filter((mod) => enabledModules?.[mod.id]?.enabled === true).map((mod) => {
    const publicData = enabledModules[mod.id];
    const clientBadge = clientBadges.find((b) => b.id === mod.id)?.badge;
    const badge = clientBadge ?? (mod.getBadge ? { active: Boolean(mod.getBadge(publicData)) } : null);

    return { ...mod, badge, publicData };
  });
}
