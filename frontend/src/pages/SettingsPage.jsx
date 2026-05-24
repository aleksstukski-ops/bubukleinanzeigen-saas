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
  green:  { label: "Gruen",  color: "#16a34a" },
  purple: { label: "Lila",   color: "#7c3aed" },
  rose:   { label: "Rose",   color: "#e11d48" },
  orange: { label: "Orange", color: "#ea580c" },
};

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || "Aktion fehlgeschlagen.";
}

function ProfileSettings({ user, onSaved }) {
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isDirty =
    (fullName || "") !== (user?.full_name || "") ||
    (email || "") !== (user?.email || "");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const res = await api.patch("/auth/me", {
        full_name: fullName.trim() || null,
        email: email.trim(),
      });
      setSuccess(true);
      if (onSaved) onSaved(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card space-y-4">
      <header>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>{"👤"} Profil</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Dein Name und E-Mail-Adresse fuer Login und Rechnungen.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => { setFullName(e.target.value); setSuccess(false); }}
            placeholder="Vor- und Nachname"
            className="input"
            disabled={saving}
            autoComplete="name"
            maxLength={255}
          />
        </div>
        <div>
          <label className="label">E-Mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setSuccess(false); }}
            placeholder="du@example.com"
            className="input"
            disabled={saving}
            autoComplete="email"
            maxLength={255}
            required
          />
        </div>
      </div>
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          {"✓"} Profil aktualisiert
        </div>
      )}
      <button
        type="button"
        className="btn-primary"
        onClick={handleSave}
        disabled={saving || !isDirty || !email.trim()}
      >
        {saving ? "Speichert..." : "Profil speichern"}
      </button>
    </section>
  );
}

function PasswordSettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordTooShort = newPassword.length > 0 && newPassword.length < 8;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card space-y-4">
      <header>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>{"🔑"} Passwort aendern</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Mindestens 8 Zeichen. Du wirst nach der Aenderung NICHT abgemeldet.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Aktuelles Passwort</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => { setCurrentPassword(e.target.value); setSuccess(false); }}
            className="input"
            autoComplete="current-password"
            disabled={saving}
          />
        </div>
        <div>
          <label className="label">Neues Passwort</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setSuccess(false); }}
            className="input"
            autoComplete="new-password"
            disabled={saving}
            minLength={8}
          />
          {passwordTooShort && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Mindestens 8 Zeichen.</p>
          )}
        </div>
        <div>
          <label className="label">Neues Passwort bestaetigen</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setSuccess(false); }}
            className="input"
            autoComplete="new-password"
            disabled={saving}
          />
          {mismatch && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Passwoerter stimmen nicht ueberein.</p>
          )}
        </div>
      </div>
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          {"✓"} Passwort aktualisiert
        </div>
      )}
      <button
        type="button"
        className="btn-primary"
        onClick={handleSave}
        disabled={saving || !canSubmit}
      >
        {saving ? "Aendert..." : "Passwort aendern"}
      </button>
    </section>
  );
}

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
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card space-y-4">
      <header>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>{"🔔"} Benachrichtigungen</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Wann moechtest du ueber neue Nachrichten informiert werden?
        </p>
      </header>
      <div className="space-y-3">
        <label
          className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>Push-Benachrichtigung</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>Browser-Push bei neuer Nachricht.</div>
          </div>
          <input
            type="checkbox"
            checked={pushEnabled}
            onChange={(e) => { setPushEnabled(e.target.checked); setSuccess(false); }}
            className="h-5 w-5"
          />
        </label>
        <label
          className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text)" }}>E-Mail-Benachrichtigung</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>E-Mail an {user?.email || "deine Adresse"}.</div>
          </div>
          <input
            type="checkbox"
            checked={emailEnabled}
            onChange={(e) => { setEmailEnabled(e.target.checked); setSuccess(false); }}
            className="h-5 w-5"
          />
        </label>
      </div>
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          {"✓"} Gespeichert
        </div>
      )}
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

function DangerZone({ user, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async () => {
    if (confirmEmail.trim().toLowerCase() !== (user?.email || "").toLowerCase()) {
      setError("Email-Adresse stimmt nicht ueberein.");
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await api.delete("/auth/me");
      if (onDeleted) onDeleted();
    } catch (err) {
      setError(getErrorMessage(err));
      setDeleting(false);
    }
  };

  return (
    <section
      className="rounded-2xl border p-5"
      style={{
        background: "var(--surface)",
        borderColor: "rgb(220 38 38 / 0.4)",
      }}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-red-600 dark:text-red-400">{"⚠️"} Gefahrenzone</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Account loeschen — alle Konten, Inserate, Nachrichten und Vorlagen werden unwiderruflich entfernt.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => { setOpen(true); setError(""); }}
            className="shrink-0 rounded-lg border border-red-500 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-500 hover:text-white dark:text-red-400 dark:hover:text-white"
          >
            Account loeschen
          </button>
        )}
      </header>

      {open && (
        <div className="mt-4 space-y-3 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-700 dark:bg-red-900/20">
          <p className="text-sm text-red-700 dark:text-red-300">
            Gib zur Bestaetigung deine E-Mail-Adresse ein:{" "}
            <span className="font-mono font-semibold">{user?.email}</span>
          </p>
          <input
            type="email"
            value={confirmEmail}
            onChange={(e) => { setConfirmEmail(e.target.value); setError(""); }}
            placeholder={user?.email || "email@example.com"}
            className="input"
            disabled={deleting}
            autoComplete="off"
          />
          {error && (
            <div className="rounded-lg border border-red-400 bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-300">
              {error}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || !confirmEmail.trim()}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-[0.98] disabled:opacity-60"
            >
              {deleting ? "Wird geloescht..." : "Ja, Account endgueltig loeschen"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setConfirmEmail(""); setError(""); }}
              disabled={deleting}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-black/5 disabled:opacity-60 dark:hover:bg-white/5"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function SettingsPage() {
  const { theme, accent, setTheme, setAccent, themes, accents } = useTheme();
  const { user, refreshUser, logout } = useAuth();

  const handleAccountDeleted = async () => {
    // Backend returned 204; flush local auth state so the user lands on /login.
    try {
      await logout();
    } catch (_) {
      // best-effort logout — even if it fails, force a reload onto /login
      window.location.assign("/login");
    }
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>Einstellungen</p>
        <h1 className="mt-1 text-2xl font-semibold" style={{ color: "var(--text)" }}>Konto & Erscheinungsbild</h1>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>
          Profil, Passwort, Benachrichtigungen und Theme — alles an einem Ort.
        </p>
      </section>

      <ProfileSettings user={user} onSaved={() => refreshUser && refreshUser()} />

      <PasswordSettings />

      <NotificationSettings user={user} onSaved={() => refreshUser && refreshUser()} />

      {/* Theme */}
      <section className="card space-y-4">
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>{"🎨"} Farbmodus</h2>
        <div className="flex flex-wrap gap-3">
          {themes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTheme(t)}
              className="flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition active:scale-[0.98]"
              style={{
                borderColor: theme === t ? "var(--accent)" : "var(--border)",
                background: theme === t ? "var(--accent-bg)" : "var(--surface)",
                color: theme === t ? "var(--accent-text)" : "var(--text)",
              }}
            >
              <span>{t === "light" ? "☀️" : "🌙"}</span>
              <span>{THEME_LABELS[t]}</span>
              {theme === t && <span className="ml-1 text-xs">{"✓"}</span>}
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
                className="flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition active:scale-[0.98]"
                style={{
                  borderColor: accent === a ? meta.color : "var(--border)",
                  background: accent === a ? "var(--accent-bg)" : "var(--surface)",
                  color: accent === a ? meta.color : "var(--text)",
                }}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full"
                  style={{ background: meta.color }}
                />
                <span>{meta.label}</span>
                {accent === a && <span className="ml-1 text-xs">{"✓"}</span>}
              </button>
            );
          })}
        </div>
      </section>

      {/* Account info */}
      <section className="card">
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>Konto-Info</h2>
        <div className="mt-3 grid gap-1 text-sm sm:grid-cols-2" style={{ color: "var(--text-muted)" }}>
          <div>Plan: <span style={{ color: "var(--text)" }}>{user?.plan || "—"}</span></div>
          <div>Konto-Limit: <span style={{ color: "var(--text)" }}>{user?.account_limit ?? 0}</span></div>
          <div>Mitglied seit: <span style={{ color: "var(--text)" }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString("de-DE") : "—"}</span></div>
          <div>Admin: <span style={{ color: "var(--text)" }}>{user?.is_admin ? "Ja" : "Nein"}</span></div>
        </div>
      </section>

      <DangerZone user={user} onDeleted={handleAccountDeleted} />
    </div>
  );
}
