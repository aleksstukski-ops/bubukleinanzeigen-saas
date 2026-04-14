export default function Modal({ open, title, description, children, footer, onClose }) {
  if (typeof document !== "undefined") {
    document.documentElement.style.overflow = open ? "hidden" : "";
    document.body.style.overflow = open ? "hidden" : "";
  }
  return (
    <div className={["fixed inset-0 z-40 transition-all duration-200", open ? "pointer-events-auto" : "pointer-events-none"].join(" ")} aria-hidden={open ? "false" : "true"}>
      <div className={["absolute inset-0 bg-slate-900/50 transition-opacity duration-200", open ? "opacity-100" : "opacity-0"].join(" ")} onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[100dvh] items-end justify-center p-0 md:inset-0 md:items-center md:p-4">
        <div className={["w-full rounded-t-2xl bg-white shadow-xl transition-transform duration-200 md:max-w-lg md:rounded-2xl", open ? "translate-y-0" : "translate-y-full md:translate-y-4"].join(" ")} style={{ transform: open ? "translate3d(0,0,0)" : "translate3d(0,100%,0)" }} role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="max-h-[85dvh] overflow-y-auto overscroll-contain">
            <div className="border-b border-slate-200 px-4 pb-4 pt-4 md:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="modal-title" className="text-lg font-semibold text-slate-900">{title}</h2>
                  {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
                </div>
                <button type="button" onClick={onClose} className="btn-secondary px-3 py-2" aria-label="Modal schließen">Schließen</button>
              </div>
            </div>
            <div className="px-4 py-4 md:px-6">{children}</div>
            {footer ? <div className="border-t border-slate-200 px-4 py-4 md:px-6" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
