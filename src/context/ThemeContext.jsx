// src/context/ThemeContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { applyAccentColor } from "../lib/color";

const DEFAULT_ACCENT = "#6d5bff";
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("dark");
  const [accentColor, setAccentColorState] = useState(DEFAULT_ACCENT);
  const [ready, setReady] = useState(false);

  // Charge les préférences sauvegardées au démarrage (thème + accent), et
  // les applique tout de suite (attribut data-theme + variables CSS d'accent)
  // pour éviter un flash de la mauvaise couleur au premier rendu.
  useEffect(() => {
    window.launcher.settings.get().then((settings) => {
      const savedTheme = settings?.preferences?.theme ?? "dark";
      const savedAccent = settings?.preferences?.accentColor ?? DEFAULT_ACCENT;
      setThemeState(savedTheme);
      setAccentColorState(savedAccent);
      document.documentElement.dataset.theme = savedTheme;
      applyAccentColor(savedAccent);
      setReady(true);
    });
  }, []);

  const setTheme = (next) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    window.launcher.settings.setPreference("theme", next);
  };

  const setAccentColor = (hex) => {
    setAccentColorState(hex);
    applyAccentColor(hex);
    window.launcher.settings.setPreference("accentColor", hex);
  };

  // Évite un flash visuel : on affiche seulement une fois thème/accent connus.
  if (!ready) return null;

  return (
    <ThemeContext.Provider value={{ theme, accentColor, setTheme, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
