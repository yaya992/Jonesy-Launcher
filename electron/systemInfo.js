const os = require("os");

/** Infos matérielles de la machine, telles qu'affichées dans le launcher. */
function getSystemInfo() {
  return {
    totalRamGB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    freeRamGB: Math.round((os.freemem() / 1024 ** 3) * 10) / 10,
    cpuCores: os.cpus().length,
    cpuModel: os.cpus()[0]?.model?.trim() || "CPU inconnu",
    platform: os.platform(),
    arch: os.arch(),
  };
}

/**
 * Compare la machine aux prérequis d'un jeu (`requirements` du manifest).
 * Ne bloque jamais le lancement : renvoie juste de quoi afficher un
 * avertissement, car des prérequis indicatifs ne doivent pas empêcher
 * quelqu'un d'essayer.
 */
function checkRequirements(requirements) {
  const system = getSystemInfo();
  if (!requirements) return { system, meets: true, warnings: [] };

  const warnings = [];

  if (requirements.ramGB && system.totalRamGB < requirements.ramGB) {
    warnings.push(
      `RAM : ${system.totalRamGB} Go détectés, ${requirements.ramGB} Go recommandés.`
    );
  }

  if (requirements.cpuCores && system.cpuCores < requirements.cpuCores) {
    warnings.push(
      `CPU : ${system.cpuCores} cœurs détectés, ${requirements.cpuCores} recommandés.`
    );
  }

  return { system, meets: warnings.length === 0, warnings };
}

module.exports = { getSystemInfo, checkRequirements };
