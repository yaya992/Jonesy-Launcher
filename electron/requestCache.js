// electron/requestCache.js
//
// Petit cache mémoire pour éviter de spammer le backend avec des requêtes
// identiques. Deux optimisations distinctes :
//
// 1. TTL par clé : un résultat récent est réutilisé tel quel, pas de requête
//    réseau tant qu'il n'a pas expiré.
// 2. Déduplication des appels concurrents : si plusieurs composants
//    demandent la même chose à quelques millisecondes d'intervalle (ex: App,
//    LoginScreen et Settings qui interrogent tous /launcher/status au
//    démarrage), un seul vrai appel réseau part — tous reçoivent le même
//    résultat une fois résolu, au lieu de 3 requêtes identiques en parallèle.

function createCache() {
  const entries = new Map(); // key -> { value, expiresAt }
  const inflight = new Map(); // key -> Promise en cours

  async function cachedFetch(key, ttlMs, fetchFn) {
    const cached = entries.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const pending = inflight.get(key);
    if (pending) return pending;

    const promise = (async () => {
      try {
        const value = await fetchFn();
        entries.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
      } finally {
        inflight.delete(key);
      }
    })();

    inflight.set(key, promise);
    return promise;
  }

  /** Invalide une clé précise, ou tout le cache si aucune clé n'est donnée. */
  function invalidate(key) {
    if (key) entries.delete(key);
    else entries.clear();
  }

  return { cachedFetch, invalidate };
}

module.exports = { createCache };
