import { createContext, useContext, useEffect, useState, useCallback } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  // Message à afficher sur l'écran de login après une déconnexion "forcée"
  // (ex: session expirée) — l'écran qui a demandé le logout disparaît en
  // même temps que le compte, donc le message doit vivre ici pour survivre.
  const [notice, setNotice] = useState(null);

  const refreshAccounts = useCallback(async () => {
    setAccounts(await window.launcher.auth.listAccounts());
  }, []);

  useEffect(() => {
    Promise.all([window.launcher.auth.me(), window.launcher.auth.listAccounts()]).then(
      ([acc, list]) => {
        setAccount(acc);
        setAccounts(list);
        setLoading(false);
      }
    );
  }, []);

  const login = useCallback(
    async (credentials) => {
      const acc = await window.launcher.auth.login(credentials);
      setAccount(acc);
      setNotice(null);
      await refreshAccounts();
      return acc;
    },
    [refreshAccounts]
  );

  const logout = useCallback(
    async (message) => {
      await window.launcher.auth.logout();
      setAccount(null);
      setNotice(message ?? null);
      await refreshAccounts();
    },
    [refreshAccounts]
  );

  /** Bascule sur un compte déjà mémorisé, sans repasser par le mot de passe. */
  const switchAccount = useCallback(
    async (email) => {
      const acc = await window.launcher.auth.switchAccount(email);
      setAccount(acc);
      await refreshAccounts();
      return acc;
    },
    [refreshAccounts]
  );

  /** Oublie un compte mémorisé ; si c'était l'actif, on retombe sur l'écran de login. */
  const removeAccount = useCallback(
    async (email) => {
      await window.launcher.auth.removeAccount(email);
      const current = await window.launcher.auth.me();
      setAccount(current);
      await refreshAccounts();
    },
    [refreshAccounts]
  );

  return (
    <AuthContext.Provider
      value={{
        account,
        accounts,
        loading,
        login,
        logout,
        switchAccount,
        removeAccount,
        notice,
        clearNotice: () => setNotice(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
