/**
 * Stub de démo : simule un statut "en direct" qui change environ 1 fois sur
 * 3. À remplacer par un vrai appel à l'API Twitch (endpoint "Get Streams",
 * avec un token App Access Token) pour vérifier si la chaîne configurée
 * diffuse actuellement.
 *
 * Attention : cette fonction est appelée à chaque requête /launcher/status
 * (chaque launcher connecté la poll toutes les 60s). Si tu branches un vrai
 * appel à l'API Twitch ici, ajoute un petit cache (30-60s) pour éviter de
 * la spammer inutilement — pas besoin d'interroger Twitch à chaque poll de
 * chaque joueur.
 *
 * Garde la même forme de retour ({ live }) et le reste (badge dans la
 * sidebar du launcher) fonctionne sans rien changer d'autre.
 */
function isTwitchLive() {
  return Math.random() < 0.35;
}

module.exports = { isTwitchLive };
