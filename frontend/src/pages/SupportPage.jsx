import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import api from "../lib/api";

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || "Senden fehlgeschlagen.";
}

const FAQ_ITEMS = [
  {
    q: "Wie verbinde ich mein Kleinanzeigen-Konto?",
    a: "Unter Konten -> Konto hinzufuegen kannst du den Login-Vorgang starten. Beim ersten Mal oeffnet sich ein sichtbares Browser-Fenster, in dem du dich wie gewohnt bei Kleinanzeigen anmeldest. Deine Session wird verschluesselt gespeichert.",
  },
  {
    q: "Warum sehe ich 'Session abgelaufen'?",
    a: "Kleinanzeigen meldet Sessions nach einigen Wochen Inaktivitaet ab. Klicke unter Konten auf 'Neu einloggen', um die Session zu erneuern — alle Inserate, Nachrichten und Auto-Bumps laufen danach wie zuvor weiter.",
  },
  {
    q: "Was passiert bei Plan-Wechsel?",
    a: "Upgrades laufen ueber Stripe Checkout und sind sofort aktiv. Downgrades und Kuendigung verwaltest du im Stripe-Kundenportal — du behaeltst alle Premium-Funktionen bis zum Ende der Abrechnungsperiode.",
  },
  {
    q: "Wie funktioniert Auto-Bump?",
    a: "Du legst pro Inserat ein Intervall fest (6h / 12h / 24h / 48h). Unser Worker schiebt das Inserat zu jedem Termin automatisch nach oben. Pausieren oder loeschen kannst du eine Regel jederzeit unter Auto-Bump.",
  },
  {
    q: "Werden meine Daten weitergegeben?",
    a: "Nein. Deine Kleinanzeigen-Session liegt Fernet-verschluesselt in unserer Datenbank. Nur du und deine eingeloggte Browser-Session koennen darauf zugreifen. Details findest du in unserer Datenschutzerklaerung.",
  },
  {
    q: "Wie kann ich meinen Account loeschen?",
    a: "Unter Einstellungen -> Gefahrenzone. Wir loeschen Konto, alle Verkaufskonten, Inserate, Nachrichten und Vorlagen unwiderruflich.",
  },
];

const SUBJECT_PRESETS = [
  "Frage zu meinem Abo",
  "Login zu Kleinanzeigen klappt nicht",
  "Bug / unerwartetes Verhalten",
  "Feature-Wunsch",
  "Datenschutz / Account loeschen",
  "Sonstiges",
];

function FaqEntry({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <li
      className="rounded-lg border transition"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{q}</span>
        <span
          className="shrink-0 text-lg"
          style={{
            color: "var(--text-subtle)",
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        >
          {"+"}
        </span>
      </button>
      {open && (
        <div className="border-t px-4 py-3 text-sm" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          {a}
        </div>
      )}
    </li>
  );
}

export default function SupportPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({
    name: user?.full_name || "",
    email: user?.email || "",
    subject: "",
    message: "",
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const canSubmit =
    form.name.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.subject.trim().length > 0 &&
    form.message.trim().length >= 10;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSending(true);
    setError("");
    setSuccess(false);
    try {
      await api.post("/support/contact", {
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setSuccess(true);
      setForm((f) => ({ ...f, subject: "", message: "" }));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>{"💬"} Support</p>
        <h1 className="mt-1 text-2xl font-semibold" style={{ color: "var(--text)" }}>Hilfe & Kontakt</h1>
        <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>
          Antwort innerhalb von 24 Stunden an Werktagen. Pro/Business-Kunden erhalten Prioritaets-Support.
        </p>
      </section>

      {/* Kontaktformular + FAQ side-by-side on lg, stacked on mobile */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="card space-y-4">
          <header>
            <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>Nachricht senden</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--text-subtle)" }}>
              Wir antworten an deine Login-E-Mail.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setSuccess(false); }}
                  className="input"
                  required
                  maxLength={120}
                  disabled={sending}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="label">E-Mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setSuccess(false); }}
                  className="input"
                  required
                  maxLength={255}
                  disabled={sending}
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="label">Betreff</label>
              <input
                type="text"
                list="support-subjects"
                value={form.subject}
                onChange={(e) => { setForm((f) => ({ ...f, subject: e.target.value })); setSuccess(false); }}
                className="input"
                required
                maxLength={200}
                disabled={sending}
                placeholder="Worum geht es?"
              />
              <datalist id="support-subjects">
                {SUBJECT_PRESETS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="label">Nachricht</label>
              <textarea
                value={form.message}
                onChange={(e) => { setForm((f) => ({ ...f, message: e.target.value })); setSuccess(false); }}
                rows={8}
                className="input"
                required
                maxLength={4000}
                disabled={sending}
                placeholder="Beschreibe dein Anliegen so detailliert wie moeglich — Fehlermeldungen, betroffene Konten/Inserate, Browser."
              />
              <p className="mt-1 text-xs" style={{ color: "var(--text-subtle)" }}>
                {form.message.trim().length < 10
                  ? `Mindestens 10 Zeichen (${form.message.trim().length}/10)`
                  : `${form.message.length} / 4000 Zeichen`}
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {"✓"} Nachricht gesendet — wir melden uns per E-Mail.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn-primary" disabled={sending || !canSubmit}>
                {sending ? "Sendet..." : "Nachricht senden"}
              </button>
              <a
                href="mailto:support@bububay.de"
                className="text-sm font-medium hover:underline"
                style={{ color: "var(--accent)" }}
              >
                support@bububay.de
              </a>
            </div>
          </form>
        </section>

        <section className="card space-y-4">
          <header>
            <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>Haeufige Fragen</h2>
            <p className="mt-1 text-xs" style={{ color: "var(--text-subtle)" }}>
              Klick zum Aufklappen.
            </p>
          </header>

          <ul className="space-y-2">
            {FAQ_ITEMS.map((item) => (
              <FaqEntry key={item.q} q={item.q} a={item.a} />
            ))}
          </ul>

          <div
            className="rounded-lg border p-4 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--text-muted)" }}
          >
            <p className="font-semibold" style={{ color: "var(--text)" }}>{"📚"} Mehr lesen</p>
            <ul className="mt-2 space-y-1">
              <li>
                <a
                  href="https://github.com/aleksstukski-ops/bubukleinanzeigen-saas#readme"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                  style={{ color: "var(--accent)" }}
                >
                  README & Setup
                </a>
              </li>
              <li>
                <a href="/datenschutz" className="hover:underline" style={{ color: "var(--accent)" }}>
                  Datenschutzerklaerung
                </a>
              </li>
              <li>
                <a href="/agb" className="hover:underline" style={{ color: "var(--accent)" }}>
                  AGB
                </a>
              </li>
              <li>
                <a href="/impressum" className="hover:underline" style={{ color: "var(--accent)" }}>
                  Impressum
                </a>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
