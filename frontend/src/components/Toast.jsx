import { createContext, useContext, useState } from "react";

/**
 * Global toast notification system.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success("Inserat hochgeschoben");
 *   toast.error("Server-Fehler");
 *   toast.info("Wird verarbeitet");
 *   toast.show({ type: "success", message: "...", duration: 5000 });
 *
 * Stack up to 4 toasts at once; each auto-dismisses after 3 s (or a
 * caller-supplied duration). Render <ToastContainer /> once at the
 * application shell so toasts appear above everything else.
 */

const ToastContext = createContext(null);

let _nextId = 1;

const TYPE_STYLES = {
  success: {
    icon: "✓",
    bg: "rgb(16 185 129)",
    accent: "rgb(5 150 105)",
  },
  error: {
    icon: "✕",
    bg: "rgb(220 38 38)",
    accent: "rgb(185 28 28)",
  },
  info: {
    icon: "ℹ",
    bg: "rgb(37 99 235)",
    accent: "rgb(29 78 216)",
  },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const show = ({ type = "info", message, duration = 3000 }) => {
    if (!message) return null;
    const id = _nextId++;
    const safeType = TYPE_STYLES[type] ? type : "info";
    setToasts((prev) => {
      // Stack cap: keep the newest 4
      const next = [...prev, { id, type: safeType, message }];
      return next.length > 4 ? next.slice(next.length - 4) : next;
    });
    if (duration > 0) {
      window.setTimeout(() => dismiss(id), duration);
    }
    return id;
  };

  const api = {
    show,
    success: (message, opts = {}) => show({ ...opts, type: "success", message }),
    error: (message, opts = {}) => show({ ...opts, type: "error", message }),
    info: (message, opts = {}) => show({ ...opts, type: "info", message }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] mx-auto flex max-w-md flex-col items-stretch gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:max-w-sm sm:items-end sm:px-0"
    >
      {toasts.map((t) => {
        const style = TYPE_STYLES[t.type] || TYPE_STYLES.info;
        return (
          <div
            key={t.id}
            role={t.type === "error" ? "alert" : "status"}
            className="pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 text-sm text-white shadow-lg"
            style={{ background: style.bg }}
          >
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.18)" }}
            >
              {style.icon}
            </span>
            <div className="min-w-0 flex-1 leading-snug">{t.message}</div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Schliessen"
              className="shrink-0 rounded p-1 text-lg leading-none text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              {"×"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Subscribers without a Provider fall back to a no-op stub so optional
 * call sites don't have to gate every `toast?.success(...)`.
 */
const NOOP_TOAST = {
  show: () => null,
  success: () => null,
  error: () => null,
  info: () => null,
  dismiss: () => undefined,
};

export function useToast() {
  return useContext(ToastContext) || NOOP_TOAST;
}

export default ToastProvider;
