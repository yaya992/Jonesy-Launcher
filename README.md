# Game Launcher (Electron + React)

Launcher desktop type Retrac : navigation verticale **Home / Library / Settings**,
avec un vrai backend local de téléchargement (manifest JSON, reprise HTTP,
vérification SHA-256, réparation).

## Structure

```
electron/
  main.js          → process principal, IPC, fenêtre frameless
  preload.js       → API exposée au renderer via contextBridge (sécurisé)
  gameManager.js   → logique métier : manifest, install/verify/repair
  downloader.js    → téléchargement bas niveau (resume + hash)
  authService.js   → login/logout, stockage du compte (electron-store)
src/
  App.jsx, components/, pages/, context/, hooks/   → UI React (Tailwind)
```

## Installation

```bash
npm install
npm run dev
```

`npm run dev` lance **3 process en parallèle** (via `concurrently`) :

1. **`backend:dev`** → `backend/server.js`, un petit serveur Express local
   (port `4000`) qui génère un manifest de démo (fichiers factices) et une
   route de login factice. Sert uniquement à tester le launcher en local,
   sans dépendre d'un vrai serveur.
2. **`vite`** → sert le React (port `5173`).
3. **`electron:dev`** → attend que les deux ports soient prêts (`wait-on`)
   puis lance la fenêtre Electron.

En dev, `config.json` (racine du projet) pointe déjà vers
`http://localhost:4000/launcher/...` — rien à configurer, `npm run dev`
suffit pour tester install/verify/repair/launch de bout en bout.

## Build (Windows uniquement)

```bash
npm run build:installer
```

Produit un installeur NSIS prêt à distribuer :
`release/Game Launcher Setup <version>.exe` (le nom exact suit
`package.json` → `productName`/`version`), accompagné de `latest.yml`
(nécessaire à l'auto-updater, voir plus bas). `npm run electron:build` fait
exactement la même chose — `build:installer` n'est qu'un alias plus explicite.

- Build **uniquement l'app Windows** (`electron-builder --win`, cible NSIS)
  — pas macOS/Linux, pas le backend de dev.
- Le backend Express (`backend/`) n'est **jamais packagé** : il n'est
  référencé nulle part dans `build.files` (`package.json`), donc absent du
  binaire final. En prod, ton vrai backend tourne à part, et son URL est
  réglée dans `electron/config.default.json`.
- La configuration est **embarquée dans l'exécutable** :
  `electron/config.default.json` est inclus dans l'asar et lu directement
  (`app.isPackaged === true` → pas de fichier externe à côté de l'exe).
  Pour changer les serveurs en prod, édite ce fichier **avant** de builder,
  puis relance `npm run build:installer`.
- **Construire ce type de build depuis Linux/macOS nécessite Wine**
  (`electron-builder` l'utilise pour poser l'icône/les infos de version sur
  l'exe via `rcedit`, même sans signature de code). Sur Debian/Ubuntu :
  `apt-get install wine wine32:i386` (l'architecture i386 doit être activée
  au préalable : `dpkg --add-architecture i386 && apt-get update`). Aucune
  installation supplémentaire nécessaire sur Windows.
- `npm run release` fait la même chose, en plus de **publier** l'installeur
  comme release GitHub (voir la section auto-update plus bas) — nécessite un
  `GH_TOKEN`.

## Configuration (`config.json`)

Le comportement diffère entre dev et build (`electron/config.js`, via `app.isPackaged`) :

| | Dev (`npm run dev`) | Build (`npm run electron:build`) |
|---|---|---|
| Source | `config.json` à la racine du projet | `electron/config.default.json`, embarqué dans l'asar |
| Modifiable sans rebuild ? | Oui — édite le fichier, relance l'app | Non — c'est dans l'exécutable |
| Valeur par défaut | `http://localhost:4000` (backend de dev) | à toi de la renseigner avant de builder |

```json
{
  "app": { "name": "Game Launcher", "productId": "com.stef.launcher" },
  "server": { "url": "http://localhost:4000" },
  "window": { "width": 1000, "height": 630, "minWidth": 900, "minHeight": 580 },
  "download": { "concurrency": 3 },
  "game": { "launchExecutable": "AzureAnticheat.exe" },
  "behavior": { "minimizeToTray": true, "launchAtStartup": false }
}
```

- **`server.url`** — la SEULE chose à régler pour pointer le launcher vers
  ton backend. Tous les endpoints (`/launcher/login`, `/launcher/manifest.json`,
  `/launcher/status`, `/launcher/news`…) en sont dérivés automatiquement par
  `electron/endpoints.js` — rien d'autre à toucher, même en ajoutant un
  module qui a sa propre route (voir "Système de modules" plus bas : le
  nouvel endpoint se déclare une fois dans `endpoints.js`, pas dans la config).
- `download.concurrency` : nombre de fichiers téléchargés en parallèle.
- La page **Settings** affiche l'URL du backend actif, pour vérifier
  rapidement sur quel environnement le launcher pointe.

## À adapter avant mise en prod

1. **`electron/config.default.json`** → renseigne `server.url` avec l'URL de
   ton vrai backend **avant de lancer le build** (cette valeur sera figée
   dans l'exécutable — voir "Mode mono-jeu"/config plus haut pour la
   différence dev/build). Le endpoint `POST {server.url}/launcher/login`
   doit renvoyer `{ token, account: { username, displayName, avatarUrl } }`.

2. **Manifest distant** (`{server.url}/launcher/manifest.json`). Format
   attendu (un tableau, un objet par jeu) :

   ```json
   [{
     "id": "season-main",
     "name": "Saison en cours",
     "version": "5.2.1",
     "executable": "GameClient.exe",
     "files": [
       { "path": "GameClient.exe", "url": "https://cdn/.../GameClient.exe", "size": 12345, "sha256": "..." },
       { "path": "paks/pakchunk0.pak", "url": "https://cdn/.../pakchunk0.pak", "size": 98765, "sha256": "..." }
     ]
   }]
   ```

   Génère ce manifest côté serveur à chaque build du jeu (script qui parcourt
   le dossier de build, calcule le SHA-256 de chaque fichier, et écrit le JSON) —
   ou utilise directement `backend/` tel quel, qui fait déjà tout ça.

3. **Icône de l'app** : ajoute un `build.icon` dans `package.json` (`.ico` pour
   Windows, `.icns` pour macOS) et référence-le dans `electron-builder`.


## Dossier d'installation du jeu

Par défaut, chaque jeu s'installe dans :

```
%APPDATA%\<app.productId>\games\<gameId>\
```

(équivalent natif sur macOS/Linux via `app.getPath("appData")`) — un dossier
propre et prévisible, séparé du dossier interne d'Electron (`userData`, qui
contiendrait sinon les fichiers du jeu mélangés aux préférences/au cache du
launcher).

`app.productId` (ex: `com.stef.launcher`) sert de nom de dossier plutôt que
`app.name` (ex: `Game Launcher`) : stable même si le nom affiché change plus
tard, et sans espaces ni accents qui compliqueraient des chemins Windows.
`app.name` reste le nom affiché dans l'UI (titre de fenêtre, sidebar…) —
les deux champs de `config.json` → `app` ont maintenant des rôles distincts.

Modifiable depuis **Settings → Installation → Changer**, qui ouvre un
sélecteur de dossier natif. Le launcher n'y télécharge que les futures
installations : changer de dossier alors que le jeu est déjà installé
ailleurs ne déplace pas les fichiers existants (le launcher le signale et
propose de relancer une installation/réparation depuis la Home).



- `install()` compare chaque fichier local à sa taille/hash du manifest et ne
  télécharge que ce qui manque ou diffère → mises à jour delta, pas de
  retéléchargement complet.
- Chaque téléchargement s'écrit dans un fichier `.part` : si le launcher est
  fermé en cours de route, la reprise se fait via un header `Range` HTTP.
- **Retry automatique** en cas de coupure réseau : jusqu'à 4 tentatives par
  fichier avec backoff exponentiel (1s, 2s, 4s), sans jamais jeter le `.part`
  entre deux tentatives — chaque retry reprend le transfert là où il s'est
  arrêté au lieu de repartir de zéro (testé avec un serveur qui coupe la
  connexion en plein milieu : le fichier final reste intègre).
- `verify()` recalcule le SHA-256 de chaque fichier installé et retourne la
  liste des fichiers corrompus/manquants.
- `repair()` appelle `verify()` puis ne retélécharge que les fichiers cassés.
- 3 téléchargements tournent en parallèle (configurable dans `gameManager.js`,
  constante `CONCURRENCY`).
- La progression affiche **vitesse et temps restant estimé** (moyenne mobile
  lissée sur les derniers instants, mise à jour 5x/seconde max pour ne pas
  saturer l'UI d'événements).

## Configuration du backend (`backend/game_config.json`)

Tout ce qui se configure côté backend de dev vit dans **un seul fichier**,
`backend/game_config.json` (créé automatiquement avec des valeurs par défaut
au premier lancement s'il n'existe pas) :

```json
{
  "server": {
    "port": 4000
  },
  "game": {
    "id": "season-main",
    "name": "Saison en cours",
    "displayVersion": "1.0.0",
    "executable": "GameClient.exe"
  }
}
```

- `server.port` — port d'écoute du backend de dev (lu une seule fois au
  démarrage ; la variable d'env `DEV_BACKEND_PORT` reste prioritaire si
  définie).
- `game.id` / `game.name` — identifiant et nom du jeu, affiché dans la Library.
- `game.displayVersion` — la version **lisible** à bumper à la main à chaque
  changement notable (`"1.4.2"`, `"Saison 5"`…). À ne pas confondre avec
  `version` dans le manifest : ce dernier est un hash technique calculé
  automatiquement depuis le contenu de `game/`, illisible pour un humain,
  qui sert uniquement à détecter qu'un fichier a changé.
- `game.executable` — le fichier utilisé pour vérifier que le jeu est
  installé (différent de `game.launchExecutable` côté launcher dans
  `config.json`, qui est `AzureAnticheat.exe` et sert à *lancer* le jeu).

`game.*` est relu à **chaque requête** de manifest (`game-config.js`,
fichier minuscule) : éditer `game_config.json` prend effet immédiatement,
pas besoin de relancer le backend de dev.

En prod, ton vrai backend doit exposer les mêmes champs (`name`,
`displayVersion`, `version`, `executable`, `files`) dans le manifest.

## Nouveautés (multi-jeux, news, admin, multi-comptes)

### Plusieurs jeux/saisons en parallèle
`backend/game_config.json` contient un **tableau `games`** : chaque entrée
devient un jeu distinct dans la Library, avec son propre dossier
`backend/game/<id>/` et son propre manifest. Modifier un jeu ne retouche
jamais les autres (debounce + file d'attente par jeu).

### Changelog et prérequis par jeu
Chaque jeu accepte :
- `changelog` — markdown, affiché en "Nouveautés" dépliable dans la Library
- `requirements` — `{ "ramGB": 8, "cpuCores": 4 }`, comparé au matériel réel
  de la machine (`electron/systemInfo.js`). Un avertissement s'affiche sur la
  Home si la config est en dessous, **sans jamais bloquer le lancement**.

### Actualités (page dédiée)
`backend/news.json` (éditable via le panel admin) est servi sur
`/launcher/news` et affiché dans une **page Actualités** accessible depuis la
sidebar, avec rendu markdown minimal (`src/lib/markdown.js`, texte échappé
avant transformation donc pas d'injection HTML possible).

Une pastille sur l'icône de la sidebar signale une actu jamais lue : l'id de
la plus récente est mémorisé dans les préférences (`electron-store`) quand la
page est ouverte, et la pastille réapparaît dès qu'une actu plus récente
arrive. La Home garde juste un lien discret vers cette page.

### Panel admin
`http://localhost:<port>/admin` — navbar latérale avec :
- **Accueil** — maintenance + jeux
- **Modules** — catalogue de toutes les fonctionnalités disponibles, avec un
  simple interrupteur pour chacune
- **Un lien par module ACTIVÉ**, ajouté dynamiquement sous "Modules actifs" —
  active un module dans le catalogue et son lien apparaît immédiatement dans
  la navbar, sans recharger la page. Cliquer dessus ouvre sa page dédiée :
  ses paramètres (ex: "Nombre d'actualités affichées") et, s'il en a un, son
  éditeur de contenu (liste d'articles pour Actualités, bloc markdown pour
  la FAQ).

Protégé par `server.adminPassword` (auth HTTP Basic, comparaison en temps
constant). Ajouter un jeu depuis le panel crée son dossier et son manifest
immédiatement.

Tout est généré depuis `backend/module-catalog.js` — nom, description,
paramètres, éditeur de contenu éventuel — donc ajouter un module au
catalogue suffit à lui faire apparaître sa carte, son interrupteur, et sa
page dédiée une fois activé, sans toucher à `index.html`.

### Multi-comptes
Plusieurs comptes peuvent être mémorisés simultanément (chacun avec son mot
de passe chiffré via `safeStorage`). Le sélecteur en bas de la sidebar permet
de basculer de l'un à l'autre **sans ressaisir le mot de passe**, ou d'en
ajouter un nouveau sans déconnecter l'actif. Gestion complète dans Settings.

### Barre système et démarrage automatique
Deux préférences dans Settings (persistées, valeurs initiales dans
`config.json` → `behavior`) :
- **Réduire dans la barre système** — fermer la fenêtre cache l'app dans le
  tray au lieu de quitter ; le vrai quit passe par le menu du tray.
- **Lancer au démarrage de Windows** — via `app.setLoginItemSettings`, en
  mode `openAsHidden` pour démarrer réduit plutôt qu'en ouvrant une fenêtre
  à chaque boot.

## Système de modules

Cinq modules d'exemple sont fournis, pour couvrir les cas qu'un vrai module
peut rencontrer :

| Module | Type | Contenu | Particularité |
|---|---|---|---|
| **Actualités** | page | liste d'articles éditable | pastille "non lu" (côté client) |
| **FAQ** | page | un seul bloc markdown | le plus simple des modules à contenu |
| **Discord** | link | — | pas de page, ouvre un lien externe |
| **Réseaux sociaux** | page | liste de liens éditable | plusieurs liens externes, pas juste un |
| **Statut serveur** | page | — (données live) | aucun contenu éditable : tout vient d'une requête live (`backend/server-status.js`, à brancher sur ton vrai serveur de jeu) |
| **Twitch** | link | — | param statique (`channelUrl`) + donnée live (`live`) fusionnés dans le même objet ; pastille "en direct" pilotée par le backend |
| **Équipe** | page | liste structurée éditable (nom + rôle) | ni markdown ni URL — juste des champs texte |

Ensemble, ils illustrent les deux types possibles pour un module
(`type: "page"` / `type: "link"`, voir `src/modules/registry.js`), les
formes de contenu (liste éditable, bloc markdown unique, liste structurée,
ou rien), et les deux façons de piloter un badge : `useBadge()` côté client
(Actualités — "jamais lu", mémorisé localement) ou `getBadge(publicData)`
côté backend (Twitch — "en direct maintenant", recalculé à chaque poll de
`/launcher/status` via `liveDataProvider` dans le catalogue).

Certains paramètres d'un module ne concernent que le backend (ex:
`maxPosts` pour Actualités, qui ne sert qu'à découper la réponse avant de
l'envoyer) ; d'autres doivent être connus du launcher (ex: `inviteUrl` pour
Discord, sans quoi le bouton ne saurait pas où pointer). Le catalogue
distingue les deux via `publicParams` : seuls les params listés là sont
renvoyés dans `/launcher/status`, le reste reste interne au backend.


Les fonctionnalités annexes (Actualités, et tout ce qui viendra après —
boutique, lien Discord, forum…) sont des **modules** : activables/
désactivables depuis le panel admin (ou `game_config.json` → `modules`)
sans jamais toucher au code du launcher.

```json
"modules": {
  "news": true
}
```

Un module désactivé disparaît entièrement côté joueur : son icône dans la
sidebar, sa page, et même sa route backend (`/launcher/news` renvoie 404 si
`modules.news` est `false`).

### Ajouter un nouveau module

1. Backend — ajoute une entrée dans `backend/module-catalog.js` (nom,
   description, paramètres éventuels) et une valeur par défaut dans
   `backend/game-config.js` → `DEFAULT_CONFIG.modules`. **Le panel admin
   génère sa carte tout seul**, pas besoin de toucher à `index.html`.
2. Frontend — ajoute une entrée dans `src/modules/registry.js` :

   ```js
   {
     id: "shop",
     label: "Boutique",
     icon: "storefront",     // nom d'icône Material Symbols
     Component: ShopPage,
     useBadge: useShopBadge, // optionnel — voir la forme ci-dessous
   }
   ```

Rien d'autre à modifier : `Sidebar` et `App.jsx` branchent la liste des
modules actifs dynamiquement (`useModules`), en croisant le registre avec ce
que le backend annonce sur `/launcher/status`.

`useBadge` (optionnel) doit renvoyer `{ active, onView }` — `active` pour
afficher une pastille "non vu" sur l'icône, `onView` appelé quand la page du
module s'ouvre pour l'éteindre. C'est ce que fait le module `news` pour sa
pastille "actu jamais lue".

## Mode maintenance

Pilotable depuis le panel admin (case à cocher) ou dans
`backend/game_config.json` :

```json
"maintenance": {
  "enabled": false,
  "message": "Maintenance en cours, le jeu sera de retour très vite.",
  "allowDownloads": true
}
```

Quand `enabled` passe à `true` :
- `POST /launcher/login` répond **503** avec `{ maintenance: true }` — le
  launcher affiche l'écran de maintenance au lieu de "mot de passe
  incorrect".
- Le bouton Jouer est verrouillé, et `game:launch` refuse aussi côté process
  principal : même en contournant l'UI, le jeu ne démarre pas.
- Un bandeau ambre s'affiche en haut du launcher avec le message configuré.
- `allowDownloads` (vrai par défaut) laisse les téléchargements et mises à
  jour ouverts, pour que les joueurs préparent la prochaine version pendant
  la fermeture. À `false`, tout est verrouillé.

Le launcher interroge `/launcher/status` au démarrage puis toutes les
minutes : ouvrir ou fermer le service ne demande aucun redémarrage côté
joueur.

**Si le backend est injoignable, le launcher considère qu'il n'y a PAS de
maintenance** — un serveur de statut en panne ne doit pas verrouiller un
joueur hors d'un jeu déjà installé.

## Mode mono-jeu

Tant que `games` ne contient qu'une seule entrée, la page **Library** est
masquée (elle ferait doublon avec la Home) et l'interface reste centrée sur
ce jeu. Elle réapparaît automatiquement dès qu'une deuxième saison est
ajoutée côté backend, sans changement de code.

## Hash optimisé pour les gros .pak

Le hash SHA-256 est la partie la plus coûteuse avec de gros fichiers — deux
optimisations s'appliquent partout où un hash est calculé
(`backend/manifest-builder.js` et `electron/downloader.js`) :

1. **Cache mtime+taille** (backend uniquement, `.manifest-cache.json`) — un
   fichier inchangé depuis le dernier scan réutilise son hash déjà connu,
   zéro lecture disque. Modifier un seul fichier dans un dossier de plusieurs
   Go ne rehash que ce fichier (~10-15 ms au lieu de plusieurs centaines de ms
   pour tout le dossier).
2. **Pool de `worker_threads`** (`hash-pool.js` / `hash-worker.js`, dupliqués
   côté backend et côté Electron) — chaque hash tourne dans un thread séparé,
   en streaming par blocs de 4 Mo, et plusieurs gros fichiers sont hashés
   **en parallèle** (jusqu'au nombre de cœurs CPU disponibles) au lieu d'un
   par un. Utilisé par la génération du manifest, par `verify()`/`repair()`
   côté launcher, et par la vérification d'intégrité après téléchargement.

Sur un test avec 4 fichiers de 50 Mo : ~290 ms pour tout hasher en parallèle
au premier scan, ~13 ms pour régénérer le manifest après modification d'un
seul fichier.

## Lancement du jeu

Le bouton **Jouer** ne lance pas directement l'exécutable du jeu : il lance
l'anticheat (`AzureAnticheat.exe`, nom configurable via
`game.launchExecutable` dans `config.json`), placé **à la racine du dossier
d'installation**, avec les identifiants du compte connecté en arguments :

```
AzureAnticheat.exe -email=<email> -mdp=<mot de passe>
```

Assure-toi que `AzureAnticheat.exe` fait partie des fichiers listés dans le
manifest (comme n'importe quel autre fichier du jeu), pour qu'il soit
téléchargé avec le reste.

### Élévation UAC (Windows)

La plupart des anti-cheats embarquent un manifeste `requireAdministrator`
(installation d'un driver, hooks bas niveau…). `child_process.spawn` seul ne
peut pas déclencher l'invite UAC dans ce cas : Windows renvoie
`ERROR_ELEVATION_REQUIRED`, que Node traduit en `EACCES` — une erreur peu
parlante qui ressemble à un problème de permissions sur le dossier, alors
que le vrai souci est l'absence d'élévation.

`game:launch` (main.js) détecte `process.platform === "win32"` et lance
l'anticheat via PowerShell (`Start-Process -Verb RunAs`) plutôt qu'un
`spawn` direct, ce qui déclenche l'invite UAC normalement — c'est ce que le
joueur voit s'afficher au clic sur **Jouer**. Sur macOS/Linux (rare pour un
anti-cheat Windows, mais gardé en fallback), le lancement reste un `spawn`
classique sans élévation.

### Suivi de fin de partie ("En cours" → "Jouer")

Le bouton **Jouer** passe sur **"En cours"** (désactivé) dès le lancement,
et redevient cliquable automatiquement à la fermeture du jeu — sans que le
joueur ait à revenir sur le launcher pour "réinitialiser" quoi que ce soit.

Le suivi diffère selon la plateforme, parce que l'élévation UAC change ce
qu'on peut observer :
- **Windows** — `Start-Process -PassThru` renvoie le PID du process élevé
  (imprimé sur stdout par PowerShell). Ce PID n'est pas un enfant direct de
  notre `spawn` (l'élévation casse la relation parent/enfant que Node
  pourrait suivre nativement), donc `watchWindowsProcess()` le sonde toutes
  les 4s via `tasklist /FI "PID eq <pid>"` — une simple liste de processus,
  qui ne demande pas de droits admin — jusqu'à ce qu'il disparaisse.
- **macOS/Linux** — le process reste un vrai enfant Node malgré `unref()`
  (qui empêche seulement de bloquer la fermeture du launcher), donc on
  écoute directement `child.on("exit", …)`.

Dans les deux cas, le résultat est le même événement envoyé au renderer
(`game:exited`), écouté par `useGame.js` pour repasser `running` à `false`.

L'état "en cours" lui-même vit dans un `Set` côté process principal
(`runningGames`), pas seulement dans le `useState` du composant — sinon
changer d'onglet (Home → Library → Home) démonte `useGame`, qui repart de
`running: false` par défaut au remontage, même si le jeu tourne toujours.
Au montage, `useGame` interroge `game:isRunning(gameId)` pour se resynchroniser
sur l'état réel avant de se fier aux événements `game:exited` à venir.

### Identifiants et sécurité

Le mot de passe doit être ressorti en clair pour ces arguments de lancement,
mais il n'est **jamais écrit en clair sur le disque** :
- Au login, `electron/authService.js` le chiffre avec `safeStorage`
  (DPAPI sur Windows, Keychain sur macOS, libsecret sur Linux) avant de
  l'enregistrer localement — il n'est déchiffrable que sur la même machine,
  pour le même utilisateur OS.
- Il est déchiffré à la volée seulement au moment de lancer le jeu.
- Si le déchiffrement échoue (chiffrement OS indisponible, profil différent…),
  le launcher demande une reconnexion plutôt que d'échouer silencieusement.

Ceci dit, une fois passé en argument de ligne de commande, le mot de passe
reste visible dans la liste des process le temps du lancement (limite propre
à ce mode de communication avec l'anticheat, pas au launcher lui-même) — à
garder en tête si `AzureAnticheat.exe` n'est pas sous ton contrôle.

Si le mot de passe ne peut pas être redéchiffré (session périmée, chiffrement
OS indisponible…), le launcher déconnecte proprement le compte et réaffiche
l'écran de login avec un message, plutôt que de rester bloqué sur un état
"connecté" qui ne peut plus rien lancer.

## Mise à jour automatique du launcher (GitHub Releases)

Le launcher se met à jour tout seul via `electron-updater`, en utilisant les
**GitHub Releases** de ton dépôt comme source :

1. **Vérification** — au démarrage (10s après, pour laisser l'UI se charger),
   puis toutes les heures.
2. **Téléchargement** — automatique dès qu'une version plus récente est
   trouvée (`autoDownload: true`).
3. **Installation** — au prochain redémarrage normal du launcher
   (`autoInstallOnAppQuit: true`). Jamais forcée en pleine session : une
   bannière ("Mise à jour prête") propose de redémarrer tout de suite, avec
   un bouton, mais rien n'interrompt le joueur sans qu'il le demande.

Une section **Settings → Mises à jour** affiche la version installée, et un
bouton "Vérifier" pour forcer une vérification à la demande.

### Configuration requise avant de publier

Dans `package.json` → `build.publish`, remplace `owner`/`repo` par ton vrai
dépôt GitHub :

```json
"publish": {
  "provider": "github",
  "owner": "ton-user-github",
  "repo": "ton-repo",
  "releaseType": "release"
}
```

Pour publier une nouvelle version :

```bash
# 1. Bump la version dans package.json ("version": "1.1.0")
# 2. Un token GitHub avec le scope "repo" (ou "public_repo" si le dépôt est public)
export GH_TOKEN=ghp_xxxxxxxxxxxx   # PowerShell : $env:GH_TOKEN = "ghp_..."
npm run release
```

`electron-builder` construit l'installeur NSIS **et** publie une release
GitHub avec l'installeur + `latest.yml` (le fichier qu'`electron-updater` lit
côté client pour savoir qu'une nouvelle version existe). Sans `GH_TOKEN`, la
publication échoue — utilise `npm run electron:build` (sans `--publish`) si
tu veux juste un installeur local, sans le publier.

### Dépôt privé

Un dépôt GitHub **privé** fonctionne aussi, mais `electron-updater` a besoin
d'un token pour lire les releases côté client — token qu'il ne faut **jamais
embarquer en clair** dans l'app distribuée. Options réalistes : dépôt public
uniquement pour héberger les releases (le code source peut rester ailleurs/privé),
ou remplacer le provider `github` par un provider `generic` pointant vers un
petit serveur de fichiers statiques que tu contrôles (voir la doc
`electron-updater` — `generic` accepte n'importe quelle URL HTTP(S) servant
les mêmes fichiers qu'une release GitHub).

### Ne s'applique pas en dev

`initAutoUpdater()` (electron/updater.js) ne fait rien tant que
`app.isPackaged` est faux : `npm run dev` n'a pas l'installeur nécessaire
pour appliquer une mise à jour, et electron-updater lèverait une erreur si on
essayait quand même.

## Sécurité


- `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`.
- Le renderer n'a accès qu'aux fonctions explicitement exposées dans
  `preload.js` — aucun accès direct à `fs`, `child_process`, etc.
- Les liens externes s'ouvrent dans le navigateur système, jamais dans une
  fenêtre Electron interne.
