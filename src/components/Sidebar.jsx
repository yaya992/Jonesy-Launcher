import AccountSwitcher from "./AccountSwitcher";
import { useLanguage } from "../context/LanguageContext";
import logo from "../../electron/assets/icon.png";

const CORE_ITEM_DEFS = [
  { id: "home", icon: "home" },
  { id: "library", icon: "grid_view", multiGameOnly: true },
];

const SETTINGS_ITEM_DEF = { id: "settings", icon: "settings" };

export default function Sidebar({ active, onNavigate, onAddAccount, isMultiGame, modules }) {
  const { t } = useLanguage();

  // Avec un seul jeu, la Library ferait doublon avec la Home : on la masque
  // tant qu'une deuxième saison n'est pas publiée.
  const coreItems = CORE_ITEM_DEFS.filter((item) => !item.multiGameOnly || isMultiGame).map(
    (item) => ({ ...item, label: t(`sidebar.${item.id}`) })
  );
  const settingsItem = { ...SETTINGS_ITEM_DEF, label: t("sidebar.settings") };
  // Les modules (news, et tout ce qui viendra ensuite) s'insèrent entre les
  // items fixes et Settings, uniquement s'ils sont activés côté backend.
  const navItems = [...coreItems, ...modules, settingsItem];

  return (
    <aside className="w-[76px] shrink-0 bg-base-975 flex flex-col items-center py-4">
      <img src={logo} alt="" className="w-9 h-9 rounded-xl mb-6 shadow-glow" />

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
              title={item.type === "link" && !href ? t("sidebar.notConfigured", { label: item.label }) : item.label}
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
