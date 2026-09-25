/**
 * Stub de démo : simule un serveur en ligne avec un nombre de joueurs qui
 * fluctue légèrement à chaque appel. À remplacer par une vraie requête vers
 * ton serveur de jeu — par exemple :
 *  - un ping vers l'API REST de ton proxy Velocity (nombre de joueurs connectés)
 *  - une requête vers ton backend de matchmaking (Node.js) pour son statut
 *  - un check TCP/UDP direct sur le port du serveur de jeu
 *
 * Garde la même forme de retour ({ online, playerCount, maxPlayers,
 * updatedAt }) et le reste (route, module, page launcher) fonctionne sans
 * rien changer d'autre.
 */
function getServerStatus() {
  const basePlayers = 42;
  const jitter = Math.floor(Math.random() * 15) - 7; // ±7, pour voir le nombre bouger
  return {
    online: true,
    playerCount: Math.max(0, basePlayers + jitter),
    maxPlayers: 100,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { getServerStatus };
