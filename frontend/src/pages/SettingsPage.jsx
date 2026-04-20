import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";

const THEME_LABELS = {
  light: "Hell",
  dark: "Dunkel",
};

const ACCENT_META = {
  blue:   { label: "Blau",   color: "#2563eb" },
  green:  { label: "Grün",   color: "#16a34a" },
  purple: { label: "Lila",   color: "#7c3aed" },
  rose:   { label: "Rose",   color: "#e11d48" },
  orange: { label: "Orange", color: "#ea580c" },
};

export default function SettingsPage() {
  const { theme, accent, setTheme, setAccent, themes, accents } = useTheme();
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      <section className="card">
        <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>Einstellungen</p>
        <h1 className="mt-1 text-2xl font-semibold" style={{ color: "var(--text)" }}>Erscheinungsbild</h1>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>
          Wähle ein Theme und eine Akzentfarbe. Die Einstellungen werden lokal gespeichert.
        </p>
      </section>

      {/* Theme */}
      <section className="card space-y-4">
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>Farbmodus</h2>
        <div className="flex flex-wrap gap-3">
          {themes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className="flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition"
              style={{
                borderColor: theme === t ? "var(--accent)" : "var(--border)",
                background: theme === t ? "var(--accent-bg)" : "var(--surface)",
                color: theme === t ? "var(--accent-text)" : "var(--text)",
              }}
            >
              <span>{t === "light" ? "☀️" : "🌙"}</span>
              <span>{THEME_LABELS[t]}</span>
              {theme === t && <span className="ml-1 text-xs">✓</span>}
            </button>
          ))}
        </div>
      </section>

      {/* Accent */}
      <section className="card space-y-4">
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>Akzentfarbe</h2>
        <div className="flex flex-wrap gap-3">
          {accents.map((a) => {
            const meta = ACCENT_META[a];
            return (
              <button
                key={a}
                type="button"
                onClick={() => setAccent(a)}
                className="flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition"
                style={{
                  borderColor: accent === a ? meta.color : "var(--border)",
                  background: accent === a ? "var(--accent-bg)" : "var(--surface)",
                  color: accent === a ? meta.color : "var(--text)",
                }}
              >
                <span
                  className="h-4 w-4 rounded-full"
                  style={{ background: meta.color, flexShrink: 0 }}
                />
                <span>{meta.label}</span>
                {accent === a && <span className="ml-1 text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* Preview */}
      <section className="card space-y-3">
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>Vorschau</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary">Primär</button>
          <button type="button" className="btn-secondary">Sekundär</button>
          <button type="button" className="btn-danger">Löschen</button>
        </div>
        <div>
          <label className="label">Eingabefeld</label>
          <input className="input" defaultValue="Beispieltext" readOnly />
        </div>
        <div className="card" style={{ background: "var(--surface-subtle)" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Karte im Karte — Hintergrundebene
          </p>
        </div>
      </section>

      {/* Account info */}
      <section className="card">
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>Konto</h2>
        <div className="mt-3 space-y-1 text-sm" style={{ color: "var(--text-muted)" }}>
          <div>E-Mail: <span style={{ color: "var(--text)" }}>{user?.email || "—"}</span></div>
          <div>Plan: <span style={{ color: "var(--text)" }}>{user?.plan || "—"}</span></div>
          <div>Konto-Limit: <span style={{ color: "var(--text)" }}>{user?.account_limit ?? 0}</span></div>
        </div>
      </section>
    </div>
  );
}
