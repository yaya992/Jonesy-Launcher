import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useUpdater } from "../../hooks/useUpdater";
import { useServiceStatus } from "../../hooks/useServiceStatus";

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-[11px] font-semibold text-ink-500 tracking-wide mb-2 px-0.5">
        {title}
      </h2>
      <div className="rounded-xl bg-base-900 border border-tint/[0.05] divide-y divide-tint/[0.05]">
        {children}
      </div>
    </div>
  );
}

function Row({ icon, label, value, action }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span className="material-symbols-rounded !text-[18px] text-ink-500 shrink-0">
            {icon}
          </span>
        )}
        <span className="text-sm text-ink-300 truncate">{label}</span>
      </div>
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        {value && (
          <span title={value} className="text-xs text-ink-500 truncate max-w-[180px]">
            {value}
          </span>
        )}
        {action}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <label className="inline-flex items-center cursor-pointer shrink-0">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <span
        className="w-9 h-5 rounded-full relative shrink-0 transition-colors
          border border-tint/20 bg-tint/[0.15]
          peer-checked:bg-accent-500 peer-checked:border-accent-500
          peer-focus-visible:ring-2 peer-focus-visible:ring-accent-400 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-base-900"
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-ink-100 shadow-sm transition-transform
            peer-checked:translate-x-4"
        />
      </span>
    </label>
  );
}

export default function Settings({ gameId }) {
  const { t } = useLanguage();
  const { accounts, logout, switchAccount, removeAccount } = useAuth();
  const { theme, accentColor, setTheme, setAccentColor } = useTheme();
  const { language, setLanguage } = useLanguage();
  const [settings, setSettings] = useState(null);
  const [appConfig, setAppConfig] = useState(null);
  const [system, setSystem] = useState(null);
  const [installStatus, setInstallStatus] = useState(null);
  const [folderNotice, setFolderNotice] = useState(null);
  const [appVersion, setAppVersion] = useState(null);
  const updater = useUpdater();
  const { enabledModules } = useServiceStatus();

  const ACCENT_PRESETS = [
    { label: t("settings.accentPresets.violet"), value: "#6d5bff" },
    { label: t("settings.accentPresets.cyan"), value: "#22d3ee" },
    { label: t("settings.accentPresets.pink"), value: "#f43f5e" },
    { label: t("settings.accentPresets.green"), value: "#22c55e" },
    { label: t("settings.accentPresets.orange"), value: "#f97316" },
  ];

  const refreshInstallStatus = () => {
    if (!gameId) return;
    window.launcher.library.status(gameId).then(setInstallStatus);
  };

  useEffect(() => {
    window.launcher.settings.get().then(setSettings);
    window.launcher.settings.getConfig().then(setAppConfig);
    window.launcher.system.info().then(setSystem);
    window.launcher.app.getVersion().then(setAppVersion);
    refreshInstallStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const handleChooseFolder = async () => {
    const wasInstalled = installStatus?.installed;
    const result = await window.launcher.library.chooseFolder(gameId);
    if (!result) return; // sélection annulée

    setFolderNotice(
      wasInstalled ? t("settings.folderChangedInstalled") : t("settings.folderChangedNew")
    );
    refreshInstallStatus();
  };

  const setPreference = async (key, value) => {
    const preferences = await window.launcher.settings.setPreference(key, value);
    setSettings((prev) => ({ ...prev, preferences }));
  };

  const prefs = settings?.preferences;

  return (
    <div className="p-7 overflow-y-auto h-full max-w-lg space-y-6">
      <div>
        <h1 className="text-lg font-bold text-ink-100">{t("settings.title")}</h1>
        <p className="text-xs text-ink-500 mt-0.5">{t("settings.subtitle")}</p>
      </div>

      <Section title={t("settings.sections.accounts")}>
        {accounts.map((acc) => (
          <Row
            key={acc.email}
            icon={acc.isActive ? "account_circle" : "person"}
            label={acc.displayName}
            value={acc.email}
            action={
              <div className="flex items-center gap-2">
                {acc.isActive ? (
                  <>
                    <span className="text-[10px] text-flux-400 font-semibold">{t("settings.active")}</span>
                    <button
                      onClick={() => logout()}
                      className="text-xs font-semibold text-red-400 hover:text-red-300"
                    >
                      {t("settings.logout")}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => switchAccount(acc.email)}
                      className="text-xs font-medium text-flux-400 hover:text-flux-300"
                    >
                      {t("settings.use")}
                    </button>
                    <button
                      onClick={() => removeAccount(acc.email)}
                      title={t("settings.forgetAccount")}
                      className="text-ink-500 hover:text-red-400"
                    >
                      <span className="material-symbols-rounded !text-[16px]">close</span>
                    </button>
                  </>
                )}
              </div>
            }
          />
        ))}
        {!accounts.length && <Row icon="person_off" label={t("settings.noAccounts")} />}
      </Section>

      <Section title={t("settings.sections.appearance")}>
        <Row
          icon="contrast"
          label={t("settings.theme")}
          action={
            <div className="flex items-center gap-0.5 bg-base-800 rounded-lg p-0.5">
              <button
                onClick={() => setTheme("dark")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  theme === "dark"
                    ? "bg-accent-500 text-white"
                    : "text-ink-500 hover:text-ink-300"
                }`}
              >
                {t("settings.dark")}
              </button>
              <button
                onClick={() => setTheme("light")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  theme === "light"
                    ? "bg-accent-500 text-white"
                    : "text-ink-500 hover:text-ink-300"
                }`}
              >
                {t("settings.light")}
              </button>
            </div>
          }
        />
        <Row
          icon="palette"
          label={t("settings.accentColor")}
          action={
            <div className="flex items-center gap-2">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  title={preset.label}
                  onClick={() => setAccentColor(preset.value)}
                  style={{ backgroundColor: preset.value }}
                  className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                    accentColor.toLowerCase() === preset.value
                      ? "ring-2 ring-offset-2 ring-offset-base-900 ring-accent-500"
                      : ""
                  }`}
                />
              ))}
              <label
                title={t("settings.customColor")}
                className="relative w-5 h-5 rounded-full overflow-hidden border border-tint/20 cursor-pointer shrink-0"
              >
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="absolute -top-1 -left-1 w-7 h-7 cursor-pointer"
                />
              </label>
            </div>
          }
        />
        <Row
          icon="translate"
          label={t("settings.language")}
          action={
            <div className="flex items-center gap-0.5 bg-base-800 rounded-lg p-0.5">
              <button
                onClick={() => setLanguage("fr")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  language === "fr"
                    ? "bg-accent-500 text-white"
                    : "text-ink-500 hover:text-ink-300"
                }`}
              >
                FR
              </button>
              <button
                onClick={() => setLanguage("en")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  language === "en"
                    ? "bg-accent-500 text-white"
                    : "text-ink-500 hover:text-ink-300"
                }`}
              >
                EN
              </button>
            </div>
          }
        />
      </Section>

      <Section title={t("settings.sections.behavior")}>
        <Row
          icon="dock_to_bottom"
          label={t("settings.minimizeToTray")}
          action={
            <Toggle
              checked={prefs?.minimizeToTray ?? true}
              onChange={(v) => setPreference("minimizeToTray", v)}
            />
          }
        />
        <Row
          icon="rocket_launch"
          label={t("settings.launchAtStartup")}
          action={
            <Toggle
              checked={prefs?.launchAtStartup ?? false}
              onChange={(v) => setPreference("launchAtStartup", v)}
            />
          }
        />
        {/* Uniquement si l'admin a activé le module : sinon l'option ne servirait à rien */}
        {enabledModules.discordRpc?.enabled && (
          <Row
            icon="sports_esports"
            label={t("settings.discordPresence")}
            action={
              <Toggle
                checked={prefs?.discordPresence ?? true}
                onChange={(v) => setPreference("discordPresence", v)}
              />
            }
          />
        )}
      </Section>

      <Section title={t("settings.sections.system")}>
        <Row icon="memory" label={t("settings.cpu")} value={system?.cpuModel} />
        <Row icon="developer_board" label={t("settings.cores")} value={system ? `${system.cpuCores}` : null} />
        <Row
          icon="database"
          label={t("settings.memory")}
          value={system ? `${system.totalRamGB} ${t("common.go")}` : null}
        />
      </Section>

      <Section title={t("settings.sections.installation")}>
        <Row
          icon="folder"
          label={t("settings.gameFolder")}
          value={installStatus?.installDir}
          action={
            <div className="flex items-center gap-2">
              {installStatus?.installDir && (
                <button
                  onClick={() => window.launcher.settings.openFolder(installStatus.installDir)}
                  className="text-xs font-medium text-flux-400 hover:text-flux-300"
                >
                  {t("settings.open")}
                </button>
              )}
              <button
                onClick={handleChooseFolder}
                disabled={!gameId}
                className="text-xs font-medium text-ink-300 hover:text-ink-100 disabled:opacity-40"
              >
                {t("settings.change")}
              </button>
            </div>
          }
        />
        {folderNotice && (
          <div className="px-4 py-3 text-[11px] text-amber-400 bg-amber-400/[0.06]">
            {folderNotice}
          </div>
        )}
      </Section>

      <Section title={t("settings.sections.server")}>
        <Row icon="cloud" label={t("settings.backend")} value={appConfig?.serverUrl} />
      </Section>

      <Section title={t("settings.sections.updates")}>
        <Row
          icon="system_update"
          label={t("settings.launcherVersion")}
          value={appVersion ? `v${appVersion}` : null}
          action={
            <UpdateAction
              status={updater.status}
              percent={updater.percent}
              onCheck={updater.checkNow}
              onRestart={updater.restartAndInstall}
            />
          }
        />
        {updater.status === "error" && (
          <div className="px-4 py-3 text-[11px] text-red-400 bg-red-400/[0.06]">
            {updater.message}
          </div>
        )}
      </Section>

      <p className="text-[11px] text-ink-600 px-0.5">
        {t("settings.footer", { appName: appConfig?.appName ?? "Game Launcher", version: appVersion ?? "…" })}
      </p>
    </div>
  );
}

function UpdateAction({ status, percent, onCheck, onRestart }) {
  const { t } = useLanguage();

  if (status === "downloaded") {
    return (
      <button
        onClick={onRestart}
        className="text-xs font-semibold text-flux-400 hover:text-flux-300"
      >
        {t("settings.restartToInstall")}
      </button>
    );
  }

  if (status === "checking") {
    return <span className="text-xs text-ink-500">{t("settings.checking")}</span>;
  }

  if (status === "downloading") {
    return <span className="text-xs text-ink-500">{t("settings.downloadingPercent", { percent: percent ?? 0 })}</span>;
  }

  if (status === "up-to-date") {
    return <span className="text-xs text-flux-400">{t("settings.upToDate")}</span>;
  }

  return (
    <button onClick={onCheck} className="text-xs font-medium text-ink-300 hover:text-ink-100">
      {t("settings.checkNow")}
    </button>
  );
}
