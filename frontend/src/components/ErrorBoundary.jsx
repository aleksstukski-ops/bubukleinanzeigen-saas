import { Component } from "react";

/**
 * Application-wide error boundary. Catches render-time exceptions
 * anywhere below it in the React tree and renders a friendly fallback
 * with a reload button instead of the white-screen-of-death.
 *
 * Stays a class component because that is still the only place React
 * exposes componentDidCatch / getDerivedStateFromError.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Keep the trace in the browser console for debugging; no remote
    // reporter is wired up yet, so this is the best signal we have.
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info?.componentStack);
  }

  handleReload = () => {
    // Hard reload — also resets any cached JS that might be the cause.
    window.location.reload();
  };

  handleHome = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const message = this.state.error?.message || "Unbekannter Fehler";
    const stack = this.state.error?.stack || "";

    return (
      <div
        className="flex min-h-[100dvh] items-center justify-center px-4 py-10"
        style={{ background: "var(--bg, #f8fafc)" }}
      >
        <div
          className="w-full max-w-lg rounded-2xl border p-6 text-center shadow-sm"
          style={{ background: "var(--surface, #ffffff)", borderColor: "var(--border, #e2e8f0)" }}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-3xl">
            {"⚠️"}
          </div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text, #0f172a)" }}>
            Etwas ist schiefgelaufen
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted, #475569)" }}>
            Die Seite konnte nicht angezeigt werden. Lade die Seite neu, oder gehe zurueck zum Start.
            Bleibt das Problem bestehen, melde dich beim Support.
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98]"
            >
              {"🔄"} Seite neu laden
            </button>
            <button
              type="button"
              onClick={this.handleHome}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-black/5 active:scale-[0.98] dark:hover:bg-white/5"
              style={{ borderColor: "var(--border, #e2e8f0)", color: "var(--text, #0f172a)" }}
            >
              Zur Startseite
            </button>
          </div>

          {/* Technical details — collapsible so the friendly UI stays clean */}
          {(message || stack) && (
            <details className="mt-5 text-left text-xs" style={{ color: "var(--text-subtle, #94a3b8)" }}>
              <summary className="cursor-pointer select-none">Technische Details</summary>
              <pre
                className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg p-3"
                style={{ background: "var(--bg, #f1f5f9)", color: "var(--text-muted, #475569)" }}
              >
                {message}
                {stack ? `\n\n${stack}` : ""}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
