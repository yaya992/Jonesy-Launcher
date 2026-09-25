import AccountSwitcher from "./AccountSwitcher";

const CORE_ITEMS = [
  { id: "home", label: "Home", icon: "home" },
  { id: "library", label: "Library", icon: "grid_view", multiGameOnly: true },
];

const SETTINGS_ITEM = { id: "settings", label: "Settings", icon: "settings" };

export default function Sidebar({ active, onNavigate, onAddAccount, isMultiGame, modules }) {
  // Avec un seul jeu, la Library ferait doublon avec la Home : on la masque
  // tant qu'une deuxième saison n'est pas publiée.
  const coreItems = CORE_ITEMS.filter((item) => !item.multiGameOnly || isMultiGame);
  // Les modules (news, et tout ce qui viendra ensuite) s'insèrent entre les
  // items fixes et Settings, uniquement s'ils sont activés côté backend.
  const navItems = [...coreItems, ...modules, SETTINGS_ITEM];

  return (
    <aside className="w-[76px] shrink-0 bg-base-975 flex flex-col items-center py-4">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-400 to-flux-500 grid place-items-center font-bold text-white text-sm mb-6 shadow-glow">
        G
      </div>

      <nav className="flex-1 flex flex-col items-center gap-2">
        {navItems.map((item) => {
          const isActive = active === item.id;
          const showBadge = item.badge?.active && !isActive;
          const href = item.type === "link" ? item.getHref?.(item.publicData) : null;

          const handleClick = () => {
            if (item.type === "link") {
              if (href) window.launcher.shell.openExternal(href);
              return;
            }
            onNavigate(item.id);
          };

          return (
            <button
              key={item.id}
              onClick={handleClick}
              disabled={item.type === "link" && !href}
              title={item.type === "link" && !href ? `${item.label} (non configuré)` : item.label}
              className="relative w-12 h-12 grid place-items-center group disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span
                className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-gradient-to-b from-accent-400 to-flux-500 transition-all duration-200 ${
                  isActive ? "h-6" : "h-0 group-hover:h-3"
                }`}
              />
              <span
                className={`w-11 h-11 rounded-xl grid place-items-center transition-colors ${
                  isActive
                    ? "bg-tint/[0.07] text-ink-100"
                    : "text-ink-500 group-hover:text-ink-300 group-hover:bg-tint/[0.04]"
                }`}
              >
                <span className="material-symbols-rounded !text-[22px]">{item.icon}</span>
              </span>

              {/* Pastille discrète : signale un contenu jamais vu, sans compteur */}
              {showBadge && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-flux-500 ring-2 ring-base-975" />
              )}
            </button>
          );
        })}
      </nav>

      <AccountSwitcher onAddAccount={onAddAccount} />
    </aside>
  );
}
