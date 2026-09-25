import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function AccountSwitcher({ onAddAccount }) {
  const { account, accounts, switchAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Referme le menu au clic extérieur (comportement attendu d'un popover)
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const others = accounts.filter((a) => a.email !== account?.email);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        title={account?.displayName ?? "Compte"}
        className="w-9 h-9 rounded-full bg-base-800 border border-white/10 grid place-items-center text-xs font-semibold text-slate-300 hover:border-accent-400/60 transition-colors"
      >
        {account?.displayName?.[0]?.toUpperCase() ?? "?"}
      </button>

      {open && (
        <div className="absolute bottom-0 left-12 z-50 w-56 rounded-xl bg-base-850 border border-white/10 shadow-xl overflow-hidden">
          <div className="px-3 py-2.5 border-b border-white/5">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {account?.displayName}
            </p>
            <p className="text-[10px] text-slate-500 truncate">{account?.email}</p>
          </div>

          {others.length > 0 && (
            <div className="py-1 border-b border-white/5">
              <p className="px-3 py-1 text-[10px] text-slate-500">Changer de compte</p>
              {others.map((other) => (
                <button
                  key={other.email}
                  onClick={async () => {
                    await switchAccount(other.email);
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2 flex items-center gap-2.5 hover:bg-white/[0.06] text-left"
                >
                  <span className="w-6 h-6 rounded-full bg-base-700 grid place-items-center text-[10px] font-semibold text-slate-300 shrink-0">
                    {other.displayName?.[0]?.toUpperCase() ?? "?"}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-slate-200 truncate">
                      {other.displayName}
                    </span>
                    <span className="block text-[10px] text-slate-500 truncate">
                      {other.email}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              setOpen(false);
              onAddAccount?.();
            }}
            className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-white/[0.06] text-left text-xs text-slate-300"
          >
            <span className="material-symbols-rounded !text-[16px] text-slate-500">
              person_add
            </span>
            Ajouter un compte
          </button>
        </div>
      )}
    </div>
  );
}
