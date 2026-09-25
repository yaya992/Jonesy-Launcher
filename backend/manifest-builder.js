const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { HashPool } = require("./hash-pool");

const hashPool = new HashPool();

/** Liste récursive de tous les fichiers d'un dossier, en chemins relatifs (séparateur "/"). */
function walk(dir, base = dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue; // .gitkeep, .DS_Store, etc. — jamais dans le manifest
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walk(fullPath, base));
    } else if (entry.isFile()) {
      results.push(path.relative(base, fullPath).split(path.sep).join("/"));
    }
  }
  return results;
}

/**
 * Construit la liste des fichiers (path/size/sha256) d'un dossier de jeu.
 *
 * Deux optimisations pour les gros dossiers de .pak :
 *  1. Cache mtime+taille : un fichier inchangé depuis le dernier passage
 *     réutilise son hash déjà connu — aucune lecture disque.
 *  2. Les fichiers nouveaux/modifiés sont hashés EN PARALLÈLE via un pool
 *     de worker_threads (voir hash-pool.js), en streaming par blocs de 4 Mo,
 *     donc plusieurs gros .pak à la fois sans bloquer le serveur ni charger
 *     les fichiers entiers en mémoire.
 *
 * Le cache se régénère aussi entièrement à chaque appel : un fichier
 * supprimé du dossier disparaît automatiquement du cache et du manifest.
 */
async function buildFileList({ gameDir, cachePath }) {
  fs.mkdirSync(gameDir, { recursive: true });

  let previousCache = {};
  try {
    previousCache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
  } catch {
    previousCache = {};
  }

  const relativePaths = walk(gameDir).sort();
  const toHash = []; // fichiers nouveaux/modifiés, à envoyer au pool

  const entries = relativePaths.map((relPath) => {
    const fullPath = path.join(gameDir, relPath);
    const stat = fs.statSync(fullPath);
    const cached = previousCache[relPath];
    const unchanged = cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size;

    if (!unchanged) toHash.push(fullPath);

    return {
      relPath,
      fullPath,
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      sha256: unchanged ? cached.sha256 : null,
    };
  });

  // Tous les fichiers à (re)hasher partent en même temps sur le pool de workers
  const hashResults = await Promise.all(toHash.map((fullPath) => hashPool.hashFile(fullPath)));
  const hashByFullPath = new Map(toHash.map((fullPath, i) => [fullPath, hashResults[i]]));

  const nextCache = {};
  const files = entries.map((entry) => {
    const sha256 = entry.sha256 ?? hashByFullPath.get(entry.fullPath);
    nextCache[entry.relPath] = { mtimeMs: entry.mtimeMs, size: entry.size, sha256 };
    return { path: entry.relPath, size: entry.size, sha256 };
  });

  fs.writeFileSync(cachePath, JSON.stringify(nextCache, null, 2));

  // Version dérivée automatiquement du contenu : elle change dès qu'un
  // fichier est ajouté/modifié/supprimé, sans jamais avoir à la bumper à la main.
  const fingerprint = files.map((f) => `${f.path}:${f.sha256}`).join("|");
  const version = crypto.createHash("sha256").update(fingerprint).digest("hex").slice(0, 12);

  return { files, version };
}

module.exports = { buildFileList, hashPool };
