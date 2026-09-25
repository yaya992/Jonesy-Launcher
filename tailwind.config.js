/** @type {import('tailwindcss').Config} */

// Convertit une variable CSS "R G B" en couleur Tailwind valide, en
// respectant l'opacité utilisée dans les classes (bg-accent-500/20, etc.)
const withOpacity = (variable) => {
  return ({ opacityValue }) =>
    opacityValue === undefined
      ? `rgb(var(${variable}))`
      : `rgb(var(${variable}) / ${opacityValue})`;
};

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // Fond / surfaces — les valeurs réelles sont définies dans index.css
        // (:root pour le sombre, [data-theme="light"] pour le clair).
        base: {
          975: withOpacity("--base-975"),
          950: withOpacity("--base-950"),
          900: withOpacity("--base-900"),
          850: withOpacity("--base-850"),
          800: withOpacity("--base-800"),
          700: withOpacity("--base-700"),
        },
        // Accent personnalisable par l'utilisateur — posé en JS
        // (src/lib/color.js) au choix d'une couleur, avec un défaut violet.
        accent: {
          400: withOpacity("--accent-400"),
          500: withOpacity("--accent-500"),
          600: withOpacity("--accent-600"),
        },
        flux: {
          400: withOpacity("--flux-400"),
          500: withOpacity("--flux-500"),
        },
        ink: {
          100: withOpacity("--ink-100"),
          200: withOpacity("--ink-200"),
          300: withOpacity("--ink-300"),
          400: withOpacity("--ink-400"),
          500: withOpacity("--ink-500"),
          600: withOpacity("--ink-600"),
        },
        // Overlay neutre pour bordures/fonds discrets : blanc en sombre, noir
        // en clair, avec les mêmes fractions d'opacité utilisées partout
        // (ex: bg-tint/[0.05], border-tint/10) — un seul token pour les deux thèmes.
        tint: withOpacity("--tint"),
      },
      boxShadow: {
        glow: "0 8px 30px -8px rgb(var(--accent-500) / 0.45)",
      },
    },
  },
  plugins: [],
};
