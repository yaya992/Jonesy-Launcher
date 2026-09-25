import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useServiceStatus } from "../hooks/useServiceStatus";

export default function LoginScreen({ isAddingAccount = false, onCancel, onSuccess }) {
  const { login, notice } = useAuth();
  const { maintenance, isUnderMaintenance } = useServiceStatus();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login({ email, password });
      onSuccess?.();
    } catch (err) {
      // Le bandeau de maintenance au-dessus dit déjà l'essentiel : on évite
      // d'afficher en plus un "MAINTENANCE" brut en rouge.
      setError(err.message === "MAINTENANCE" ? null : err.message || "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full grid place-items-center bg-base-950">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/5 bg-base-900 p-8 space-y-5"
      >
        <div className="text-center space-y-1">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-accent-400 to-flux-500 grid place-items-center font-bold text-white text-lg shadow-glow">
            G
          </div>
          <h1 className="text-lg font-bold mt-3">
            {isAddingAccount ? "Ajouter un compte" : "Connexion"}
          </h1>
          <p className="text-xs text-slate-500">
            {isAddingAccount
              ? "Le compte actuel reste mémorisé"
              : "Connecte-toi avec ton compte de jeu"}
          </p>
        </div>

        {isUnderMaintenance && (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <span className="material-symbols-rounded !text-[14px]">construction</span>
              Maintenance en cours
            </p>
            {maintenance?.message && (
              <p className="text-[11px] text-amber-400/80 mt-1">{maintenance.message}</p>
            )}
          </div>
        )}

        {notice && !isAddingAccount && (
          <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
            {notice}
          </p>
        )}

        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="w-full px-4 py-2.5 rounded-lg bg-base-800 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-lg bg-base-800 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="space-y-2">
          <button
            type="submit"
            disabled={loading || isUnderMaintenance}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-accent-500 to-flux-500 hover:brightness-110 disabled:opacity-50 font-semibold text-sm text-white shadow-glow"
          >
            {loading ? "Connexion…" : isAddingAccount ? "Ajouter" : "Se connecter"}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200"
            >
              Annuler
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
