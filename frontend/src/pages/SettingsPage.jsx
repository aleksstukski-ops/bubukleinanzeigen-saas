import { useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { useAuth } from "../hooks/useAuth";
import api from "../lib/api";

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

function NotificationSettings({ user, onSaved }) {
  const [pushEnabled, setPushEnabled] = useState(user?.notify_push_new_message ?? true);
  const [emailEnabled, setEmailEnabled] = useState(user?.notify_email_new_message ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isDirty =
    pushEnabled !== (user?.notify_push_new_message ?? true) ||
    emailEnabled !== (user?.notify_email_new_message ?? false);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await api.patch("/auth/notification-settings", {
        notify_push_new_message: pushEnabled,
        notify_email_new_message: emailEnabled,
      });
      setSuccess(true);
      if (onSaved) onSaved(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card space-y-4">
      <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>{"🔔"} Benachrichtigungen</h2>
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Einstellungen fur Benachrichtigungen bei neuen Nachrichten.
      </p>
      <div className="space-y-3">
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Push-Benachrichtigung</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>Browser-Benachrichtigung bei neuer Nachricht</div>
          </div>
          <input
            type="checkbox"
            checked={pushEnabled}
            onChange={(e) => { setPushEnabled(e.target.checked); setSuccess(false); }}
            className="h-5 w-5 rounded"
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>E-Mail-Benachrichtigung</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>E-Mail bei neuer Nachricht an {user?.email}</div>
          </div>
          <input
            type="checkbox"
            checked={emailEnabled}
            onChange={(e) => { setEmailEnabled(e.target.checked); setSuccess(false); }}
            className="h-5 w-5 rounded"
          />
        </label>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-600">{"✓"} Gespeichert</div>}
      <button
        type="button"
        className="btn-primary"
        onClick={handleSave}
        disabled={saving || !isDirty}
      >
        {saving ? "Speichert..." : "Speichern"}
      </button>
    </section>
  );
}

export default function SettingsPage() {
  const { theme, accent, setTheme, setAccent, themes, accents } = useTheme();
  const { user, refreshUser } = useAuth();

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

      <NotificationSettings user={user} onSaved={() => refreshUser()} />

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
