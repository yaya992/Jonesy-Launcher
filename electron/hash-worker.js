const { parentPort } = require("worker_threads");
const fs = require("fs");
const crypto = require("crypto");

// 4 Mo par chunk : beaucoup moins de passages que le défaut (64 Ko) sur un
// fichier de plusieurs Go, sans pour autant charger le fichier entier en RAM.
const CHUNK_SIZE = 4 * 1024 * 1024;

parentPort.on("message", ({ filePath, jobId }) => {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(filePath, { highWaterMark: CHUNK_SIZE });

  stream.on("data", (chunk) => hash.update(chunk));
  stream.on("end", () => {
    parentPort.postMessage({ jobId, sha256: hash.digest("hex") });
  });
  stream.on("error", (err) => {
    parentPort.postMessage({ jobId, error: err.message });
  });
});
