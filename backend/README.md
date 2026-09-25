# Backend de dev

## `game/` — le dossier source de vérité

Dépose ici les vrais fichiers du jeu (exécutable, `.pak`, assets…), dans
n'importe quelle arborescence de sous-dossiers.

Dès qu'un fichier est **ajouté, modifié ou supprimé** pendant que le backend
tourne (`npm run backend:dev` ou `npm run dev`), le manifest se régénère
tout seul :

1. `manifest-builder.js` scanne récursivement `game/`.
2. Pour chaque fichier, il compare `mtime` + taille à `.manifest-cache.json`
   (généré au run précédent). Si rien n'a changé → le SHA-256 en cache est
   réutilisé. Si le fichier est nouveau ou modifié → le SHA-256 est
   recalculé. Un fichier supprimé disparaît automatiquement du cache et du
   manifest suivant.
3. Le résultat est écrit dans `backend/manifest.json` (lisible, pour
   inspection) et servi en JSON sur `GET /launcher/manifest.json`.
4. La `version` du manifest est dérivée du contenu (hash de tous les
   chemins+hash) : elle change automatiquement dès qu'un fichier change,
   pas besoin de la bumper à la main.

Le launcher (`install`/`repair`) ne (re)télécharge alors **que les fichiers
manquants ou dont le hash a changé** — jamais le jeu entier.

Renomme ton exécutable principal en `GameClient.exe`, ou change la
constante `EXECUTABLE_NAME` dans `server.js` s'il porte un autre nom.

## Fichiers générés (ne pas éditer à la main)

- `manifest.json` — snapshot du dernier manifest généré
- `.manifest-cache.json` — cache interne (mtime/taille/hash) pour éviter de
  rehasher les fichiers inchangés

Les deux sont recréés automatiquement ; supprime-les si tu veux forcer un
rescan complet.

## Ce dossier n'est jamais packagé

`backend/` n'apparaît nulle part dans `build.files` (`package.json`) : il
est totalement absent du launcher buildé. En prod, un vrai backend sert les
mêmes routes, réglé dans `electron/config.default.json`.
