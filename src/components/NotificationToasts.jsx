// src/components/NotificationToasts.jsx
import { useNotifications } from "../hooks/useNotifications";

const TYPE_STYLES = {
  update: { icon: "system_update", accent: "text-accent-400", ring: "border-accent-500/30" },
  announcement: { icon: "campaign", accent: "text-flux-400", ring: "border-flux-500/30" },
  info: { icon: "info", accent: "text-ink-300", ring: "border-tint/10" },
  alert: { icon: "warning", accent: "text-red-400", ring: "border-red-500/30" },
};

export default function NotificationToasts() {
  const { toasts, dismiss } = useNotifications();

  if (!toasts.length) return null;

  return (
    <div className="fixed top-12 right-4 z-50 flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map((toast) => {
        const style = TYPE_STYLES[toast.type] || TYPE_STYLES.info;
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl bg-base-850 border ${style.ring} shadow-xl p-3.5 flex items-start gap-3 animate-toast-in`}
          >
            <span className={`material-symbols-rounded !text-[20px] ${style.accent} shrink-0 mt-0.5`}>
              {style.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-100 leading-snug">{toast.title}</p>
              {toast.message && (
                <p className="text-xs text-ink-400 mt-0.5 leading-snug">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-ink-600 hover:text-ink-300 shrink-0"
            >
              <span className="material-symbols-rounded !text-[16px]">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
