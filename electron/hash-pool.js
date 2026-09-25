const os = require("os");
const path = require("path");
const { Worker } = require("worker_threads");

const WORKER_SCRIPT = path.join(__dirname, "hash-worker.js");

/**
 * Pool de worker_threads dédié au hash SHA-256.
 *
 * Pourquoi : crypto.createHash est CPU-bound et bloque le thread qui
 * l'exécute pendant tout le calcul. Sur un dossier de .pak de plusieurs Go,
 * le faire dans le thread principal du serveur (même en streaming) fige les
 * autres requêtes le temps du calcul. Ici, chaque fichier est hashé dans un
 * thread séparé, et plusieurs gros fichiers sont hashés EN PARALLÈLE
 * (jusqu'à `size` à la fois — par défaut le nombre de cœurs CPU).
 */
class HashPool {
  constructor(size = Math.max(1, os.cpus().length - 1)) {
    this.nextJobId = 0;
    this.pending = new Map(); // jobId -> { resolve, reject }
    this.queue = []; // jobs en attente d'un worker libre
    this.free = [];

    this.workers = Array.from({ length: size }, () => this._spawnWorker());
  }

  _spawnWorker() {
    const worker = new Worker(WORKER_SCRIPT);
    worker.on("message", ({ jobId, sha256, error }) => {
      const job = this.pending.get(jobId);
      this.pending.delete(jobId);
      this.free.push(worker);
      if (job) error ? job.reject(new Error(error)) : job.resolve(sha256);
      this._dispatch();
    });
    worker.on("error", (err) => {
      // Le job en cours sur ce worker échoue ; on relance un worker propre
      // pour ne pas perdre une place dans le pool.
      for (const [jobId, job] of this.pending) {
        if (worker.currentJobId === jobId) {
          this.pending.delete(jobId);
          job.reject(err);
        }
      }
      this.workers = this.workers.filter((w) => w !== worker);
      this.workers.push(this._spawnWorker());
      this._dispatch();
    });
    this.free.push(worker);
    return worker;
  }

  _dispatch() {
    while (this.free.length && this.queue.length) {
      const worker = this.free.pop();
      const { filePath, jobId } = this.queue.shift();
      worker.currentJobId = jobId;
      worker.postMessage({ filePath, jobId });
    }
  }

  /** Hash un fichier en SHA-256 dans un worker du pool. Résout avec le hash hex. */
  hashFile(filePath) {
    return new Promise((resolve, reject) => {
      const jobId = this.nextJobId++;
      this.pending.set(jobId, { resolve, reject });
      this.queue.push({ filePath, jobId });
      this._dispatch();
    });
  }

  async destroy() {
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}

module.exports = { HashPool };
