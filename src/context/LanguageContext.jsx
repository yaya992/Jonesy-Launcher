// src/context/LanguageContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import fr from "../lang/fr_fr.json";
import en from "../lang/en_us.json";

const DICTIONARIES = { fr, en };
const DEFAULT_LANGUAGE = "fr";
const LanguageContext = createContext(null);

// "settings.sections.accounts" -> dict.settings.sections.accounts
function resolve(dict, key) {
  return key
    .split(".")
    .reduce((acc, part) => (acc && typeof acc === "object" ? acc[part] : undefined), dict);
}

// "Mise à jour {{version}}prête" + { version: "v1.2.0 " } -> "Mise à jour v1.2.0 prête"
function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/{{\s*(\w+)\s*}}/g, (_, name) => (vars[name] ?? ""));
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    window.launcher.settings.get().then((settings) => {
      setLanguageState(settings?.preferences?.language ?? DEFAULT_LANGUAGE);
      setReady(true);
    });
  }, []);

  const setLanguage = (lang) => {
    setLanguageState(lang);
    window.launcher.settings.setPreference("language", lang);
  };

  // Repli sur le français si une clé manque dans le dictionnaire actif (ne
  // devrait arriver que si en_us.json prend du retard sur fr_fr.json), puis
  // sur la clé brute en tout dernier recours pour ne jamais planter l'UI.
  const t = (key, vars) => {
    const dict = DICTIONARIES[language] ?? DICTIONARIES[DEFAULT_LANGUAGE];
    const value = resolve(dict, key) ?? resolve(DICTIONARIES[DEFAULT_LANGUAGE], key) ?? key;
    return typeof value === "string" ? interpolate(value, vars) : value;
  };

  if (!ready) return null;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
