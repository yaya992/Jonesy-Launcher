const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { HashPool } = require("./hash-pool");

// Pool partagé : hash SHA-256 des gros fichiers (.pak…) sur des threads
// séparés, en parallèle, sans bloquer le process principal Electron.
const hashPool = new HashPool();

const MAX_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 1000; // 1s, 2s, 4s... (backoff exponentiel)

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Une seule tentative de téléchargement. Reprend depuis un .part existant
 * via Range HTTP si présent, puis vérifie le SHA-256 une fois terminé.
 */
function downloadFileOnce(url, destPath, expectedSize, expectedSha256, onProgress, cancelToken) {
  return new Promise((resolve, reject) => {
    const partPath = destPath + ".part";
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    let startByte = 0;
    if (fs.existsSync(partPath)) {
      startByte = fs.statSync(partPath).size;
      // Si le .part est déjà plus gros que ce qui est attendu, on repart de zéro
      if (startByte >= expectedSize) {
        fs.unlinkSync(partPath);
        startByte = 0;
      }
    }

    const client = url.startsWith("https") ? https : http;
    const headers = startByte > 0 ? { Range: `bytes=${startByte}-` } : {};

    const req = client.get(url, { headers, timeout: 20000 }, (res) => {
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        res.resume();
        return reject(new Error(`Téléchargement échoué (HTTP ${res.statusCode}) pour ${url}`));
      }

      const fileStream = fs.createWriteStream(partPath, {
        flags: startByte > 0 ? "a" : "w",
      });

      let downloaded = startByte;
      let settled = false;
      const settleReject = (err) => {
        if (settled) return;
        settled = true;
        fileStream.close();
        reject(err);
      };

      // Coupure réseau en plein téléchargement (reset, timeout, DNS…) : le
      // .part reste sur disque, la tentative suivante reprendra pile où
      // ça s'est arrêté grâce au Range HTTP ci-dessus.
      res.on("error", settleReject);

      res.on("data", (chunk) => {
        if (cancelToken?.cancelled) {
          req.destroy();
          fileStream.close();
          return;
        }
        downloaded += chunk.length;
        onProgress?.(downloaded);
      });

      res.pipe(fileStream);

      fileStream.on("finish", () => {
        if (settled) return;
        settled = true;
        fileStream.close(async () => {
          if (cancelToken?.cancelled) {
            return reject(new Error("Téléchargement annulé"));
          }
          try {
            if (expectedSha256) {
              const actualHash = await hashFile(partPath);
              if (actualHash.toLowerCase() !== expectedSha256.toLowerCase()) {
                fs.unlinkSync(partPath); // fichier corrompu : on ne repart pas d'un .part invalide
                return reject(
                  new Error(`Intégrité invalide pour ${path.basename(destPath)} (hash différent)`)
                );
              }
            }
            fs.renameSync(partPath, destPath);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });

      fileStream.on("error", settleReject);
    });

    req.on("timeout", () => req.destroy(new Error(`Délai d'attente dépassé pour ${url}`)));
    req.on("error", reject);
  });
}

/**
 * Télécharge un fichier avec reprise (Range HTTP) ET retry automatique en
 * cas de coupure réseau : jusqu'à `MAX_ATTEMPTS` tentatives, avec un
 * backoff exponentiel entre chaque. Le .part n'est jamais jeté entre deux
 * tentatives (sauf en cas de hash invalide), donc chaque retry reprend le
 * transfert là où il s'est arrêté au lieu de repartir de zéro — précieux
 * sur de gros .pak avec une connexion instable.
 * Ne retente jamais un téléchargement annulé par l'utilisateur.
 */
async function downloadFile(url, destPath, expectedSize, expectedSha256, onProgress, cancelToken) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (cancelToken?.cancelled) throw new Error("Téléchargement annulé");
    try {
      return await downloadFileOnce(url, destPath, expectedSize, expectedSha256, onProgress, cancelToken);
    } catch (err) {
      lastError = err;
      if (cancelToken?.cancelled || err.message === "Téléchargement annulé") throw err;
      if (attempt < MAX_ATTEMPTS) {
        await wait(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  }
  throw new Error(`Échec après ${MAX_ATTEMPTS} tentatives : ${lastError.message}`);
}

/** Calcule le SHA-256 d'un fichier via le pool de workers (streaming, 4 Mo/bloc). */
function hashFile(filePath) {
  return hashPool.hashFile(filePath);
}

module.exports = { downloadFile, hashFile, hashPool };
