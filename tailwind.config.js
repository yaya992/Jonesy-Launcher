/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // Fond / surfaces — un seul dégradé de gris-bleu très sombre
        base: {
          975: "#07080c",
          950: "#0b0c11",
          900: "#111319",
          850: "#161822",
          800: "#1b1e29",
          700: "#242732",
        },
        // Accent unique : violet électrique → cyan, réservé aux actions clés
        accent: {
          400: "#8b7dff",
          500: "#6d5bff",
          600: "#5646d6",
        },
        flux: {
          400: "#5ce6ff",
          500: "#22d3ee",
        },
      },
      boxShadow: {
        glow: "0 8px 30px -8px rgba(109, 91, 255, 0.45)",
      },
    },
  },
  plugins: [],
};
