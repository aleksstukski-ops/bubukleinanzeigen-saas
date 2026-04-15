import { useEffect } from "react";

export default function Modal({ open, title, description, children, footer, onClose }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative z-10 w-full max-h-[100dvh] rounded-t-2xl bg-white shadow-xl md:max-w-lg md:rounded-2xl">
        <div className="max-h-[85dvh] overflow-y-auto overscroll-contain">
          <div className="border-b border-slate-200 px-4 pb-4 pt-4 md:px-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
                {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
              </div>
              <button type="button" onClick={onClose} className="btn-secondary px-3 py-2">Schließen</button>
            </div>
          </div>
          <div className="px-4 py-4 md:px-6">{children}</div>
          {footer ? <div className="border-t border-slate-200 px-4 py-4 md:px-6" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
