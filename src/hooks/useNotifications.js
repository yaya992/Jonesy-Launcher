// src/hooks/useNotifications.js
import { useEffect, useState } from "react";

const AUTO_DISMISS_MS = 8000;

export function useNotifications() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const off = window.launcher.notifications.onPush((payload) => {
      setToasts((prev) => [...prev, payload]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== payload.id));
      }, AUTO_DISMISS_MS);
    });
    return off;
  }, []);

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return { toasts, dismiss };
}
