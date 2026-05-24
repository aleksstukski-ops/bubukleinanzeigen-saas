import { Link } from "react-router-dom";

const pageStyle = {
  color: "var(--text)",
  background: "var(--surface)",
};

const cardStyle = {
  ...pageStyle,
  border: "1px solid rgba(148, 163, 184, 0.2)",
};

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8" style={pageStyle}>
      <div className="w-full max-w-xl rounded-3xl p-6 shadow-sm md:p-10" style={cardStyle}>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-xl font-bold text-white">
            B
          </div>
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">BubuBay</div>
            <div className="text-sm opacity-70">Multi-Platform Verkaufsmanager</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="text-5xl font-bold text-blue-600">404</div>
          <h1 className="text-3xl font-bold">Seite nicht gefunden</h1>
          <p className="text-sm leading-7 opacity-75 md:text-base">
            Die angeforderte Seite existiert nicht oder wurde verschoben. Du kannst direkt zurück ins Dashboard gehen
            oder zur vorherigen Ansicht zurückspringen.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/dashboard"
            className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Zum Dashboard
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="w-full rounded-2xl px-4 py-3 text-sm font-semibold"
            style={cardStyle}
          >
            Zurueck
          </button>
        </div>
      </div>
    </div>
  );
}
