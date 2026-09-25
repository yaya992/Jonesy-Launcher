import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { useServiceStatus } from "./hooks/useServiceStatus";
import { useModules } from "./hooks/useModules";
import { useCatalog } from "./hooks/useCatalog";
import { useUpdater } from "./hooks/useUpdater";
import TitleBar from "./components/TitleBar";
import Sidebar from "./components/Sidebar";
import MaintenanceBanner from "./components/MaintenanceBanner";
import UpdateBanner from "./components/UpdateBanner";
import LoginScreen from "./components/LoginScreen";
import NotificationToasts from "./components/NotificationToasts";
import Home from "./components/pages/Home";
import Library from "./components/pages/Library";
import Settings from "./components/pages/Settings";

function Shell() {
  const { account, loading } = useAuth();
  const [page, setPage] = useState("home");
  // Permet d'afficher l'écran de login pour AJOUTER un compte, sans
  // déconnecter celui qui est actif (le login bascule dessus une fois réussi).
  const [addingAccount, setAddingAccount] = useState(false);

  const { maintenance, canDownload, enabledModules } = useServiceStatus();
  const modules = useModules(enabledModules);
  const activeModule = modules.find((m) => m.id === page);
  const { mainGameId, isMultiGame } = useCatalog();
  const updater = useUpdater();

  // Ouvrir la page d'un module éteint son badge (ex: pastille "non lu").
  useEffect(() => {
    activeModule?.badge?.onView?.();
  }, [activeModule]);

  // Si la page active disparaît (Library en repassant à un seul jeu, ou un
  // module désactivé en cours de route côté backend), on retombe sur la Home
  // au lieu d'afficher un écran vide.
  useEffect(() => {
    const stillValid =
      page === "home" ||
      page === "settings" ||
      (page === "library" && isMultiGame) ||
      modules.some((m) => m.id === page);
    if (!stillValid) setPage("home");
  }, [page, isMultiGame, modules]);

  if (loading) {
    return (
      <div className="h-full grid place-items-center text-ink-500 text-sm">Chargement…</div>
    );
  }

  if (!account || addingAccount) {
    return (
      <LoginScreen
        isAddingAccount={addingAccount}
        onCancel={addingAccount ? () => setAddingAccount(false) : null}
        onSuccess={() => setAddingAccount(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      <MaintenanceBanner maintenance={maintenance} />
      <UpdateBanner
        status={updater.status}
        version={updater.version}
        restartAndInstall={updater.restartAndInstall}
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          active={page}
          onNavigate={setPage}
          onAddAccount={() => setAddingAccount(true)}
          isMultiGame={isMultiGame}
          modules={modules}
        />
        <main className="flex-1 min-w-0">
          {page === "home" && (
            <Home
              gameId={mainGameId}
              onGoToLibrary={() => setPage("library")}
              onGoToNews={modules.some((m) => m.id === "news") ? () => setPage("news") : null}
              hasUnreadNews={modules.find((m) => m.id === "news")?.badge?.active}
              isMultiGame={isMultiGame}
              maintenance={maintenance}
              canDownload={canDownload}
            />
          )}
          {page === "library" && <Library maintenance={maintenance} canDownload={canDownload} />}
          {page === "settings" && <Settings gameId={mainGameId} />}
          {activeModule?.Component && <activeModule.Component />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="h-screen flex flex-col">
      <TitleBar />
      <NotificationToasts />
      <div className="flex-1 min-h-0">
        <ThemeProvider>
          <AuthProvider>
            <Shell />
          </AuthProvider>
        </ThemeProvider>
      </div>
    </div>
  );
}
