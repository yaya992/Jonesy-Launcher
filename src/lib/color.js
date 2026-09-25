// src/lib/color.js
//
// Petits utilitaires pour dériver les nuances d'accent (plus clair / plus
// foncé) à partir d'une seule couleur choisie par l'utilisateur, et pour
// convertir en triplet "R G B" (format attendu par les variables CSS que
// Tailwind consomme via rgb(var(--x) / <alpha-value>)).

/** "#6d5bff" -> [109, 91, 255] */
export function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** [109, 91, 255] -> "109 91 255" (format brut pour une variable CSS) */
export function rgbToVar([r, g, b]) {
  return `${r} ${g} ${b}`;
}

/** Éclaircit (amount > 0) ou assombrit (amount < 0) une couleur, amount dans [-1, 1]. */
export function shade([r, g, b], amount) {
  const mix = (channel) =>
    amount >= 0
      ? Math.round(channel + (255 - channel) * amount)
      : Math.round(channel * (1 + amount));
  return [mix(r), mix(g), mix(b)];
}

/**
 * Applique une couleur d'accent choisie par l'utilisateur : dérive une
 * nuance plus claire (400) et plus foncée (600) autour de la couleur de
 * base (500), puis pose les 3 variables CSS sur :root.
 */
export function applyAccentColor(hex) {
  const base = hexToRgb(hex);
  const root = document.documentElement.style;
  root.setProperty("--accent-400", rgbToVar(shade(base, 0.22)));
  root.setProperty("--accent-500", rgbToVar(base));
  root.setProperty("--accent-600", rgbToVar(shade(base, -0.2)));
}
