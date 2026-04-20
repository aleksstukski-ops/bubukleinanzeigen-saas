import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// ── Data ────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "🗂️",
    title: "Alle Konten auf einen Blick",
    body: "Verwalte beliebig viele Kleinanzeigen-Konten in einer einzigen Oberfläche. Kein ständiges Ein- und Ausloggen mehr.",
  },
  {
    icon: "📬",
    title: "Zentrale Nachrichten-Inbox",
    body: "Alle Käufer-Nachrichten aus allen Konten in einer gemeinsamen Inbox. Direkt antworten, als gelesen markieren.",
  },
  {
    icon: "📊",
    title: "Inserat-Statistiken",
    body: "Views, Merklisten-Einträge und Preise auf einen Blick. Erkenne welche Inserate am besten laufen.",
  },
  {
    icon: "🔔",
    title: "Push-Benachrichtigungen",
    body: "Erhalte sofortige Browser-Benachrichtigungen wenn neue Nachrichten eintreffen — auch auf dem Smartphone.",
  },
  {
    icon: "⚡",
    title: "Bulk-Aktionen",
    body: "Inserate hochschieben, bearbeiten oder löschen mit wenigen Klicks. Spart Stunden manueller Arbeit pro Woche.",
  },
  {
    icon: "🔒",
    title: "Sicher & verschlüsselt",
    body: "Session-Daten werden mit Fernet-Verschlüsselung gespeichert. Deine Zugangsdaten verlassen niemals unsere Server.",
  },
];

const STEPS = [
  {
    num: "1",
    title: "Kostenlos registrieren",
    body: "E-Mail und Passwort reichen. Kein Abo, keine Kreditkarte beim Start.",
  },
  {
    num: "2",
    title: "Kleinanzeigen-Konto verbinden",
    body: "Starte den sicheren Login-Flow. Dein Konto ist in unter 2 Minuten verbunden.",
  },
  {
    num: "3",
    title: "Alle Konten zentral steuern",
    body: "Inserate, Nachrichten und Statistiken — alles an einem Ort, jederzeit.",
  },
];

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "0",
    accounts: 1,
    features: ["1 Konto", "Inserate & Nachrichten", "Push-Benachrichtigungen"],
    highlight: false,
    badge: null,
  },
  {
    id: "starter",
    name: "Starter",
    price: "9",
    accounts: 1,
    features: ["1 Konto", "Alle Free-Features", "Prioritäts-Support"],
    highlight: false,
    badge: null,
  },
  {
    id: "pro",
    name: "Pro",
    price: "19",
    accounts: 3,
    features: ["3 Konten", "Alle Starter-Features", "Bulk-Aktionen"],
    highlight: true,
    badge: "Beliebt",
  },
  {
    id: "business",
    name: "Business",
    price: "39",
    accounts: 10,
    features: ["10 Konten", "Alle Pro-Features", "Dedizierter Support"],
    highlight: false,
    badge: null,
  },
];

const FAQS = [
  {
    q: "Muss ich mein Kleinanzeigen-Passwort angeben?",
    a: "Nein. Der Login läuft über den offiziellen Kleinanzeigen-Login-Flow in einem sichtbaren Browser auf deinem Server. Wir sehen dein Passwort nie.",
  },
  {
    q: "Funktioniert das mit mehreren Konten gleichzeitig?",
    a: "Ja — genau dafür ist BubuKleinanzeigen gemacht. Je nach Plan kannst du 1 bis 10 Konten parallel verwalten.",
  },
  {
    q: "Was passiert wenn ich kündige?",
    a: "Du kannst monatlich kündigen, ohne Mindestlaufzeit. Nach der Kündigung behältst du deinen Zugang bis zum Ende des bezahlten Zeitraums.",
  },
  {
    q: "Ist der Free-Plan dauerhaft kostenlos?",
    a: "Ja. Mit dem Free-Plan kannst du 1 Kleinanzeigen-Konto dauerhaft kostenlos verwalten — ohne Zeitlimit.",
  },
  {
    q: "Auf welchen Geräten funktioniert die App?",
    a: "BubuKleinanzeigen ist eine Progressive Web App (PWA) und läuft auf Desktop, Android und iOS. Auf iOS kannst du sie direkt zum Home-Screen hinzufügen.",
  },
];

// ── Sub-components ──────────────────────────────────────────────

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-200 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors"
      >
        <span>{q}</span>
        <span className="shrink-0 text-lg text-slate-400 transition-transform" style={{ transform: open ? "rotate(45deg)" : "none" }}>
          +
        </span>
      </button>
      {open && (
        <p className="pb-4 text-sm leading-relaxed text-slate-500">{a}</p>
      )}
    </div>
  );
}

// Fake product screenshot — CSS-only UI mockup
function ProductMockup() {
  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl shadow-2xl"
      style={{ background: "#1e293b", border: "1px solid #334155" }}
    >
      {/* Fake browser chrome */}
      <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-500" />
        <span className="h-3 w-3 rounded-full bg-amber-400" />
        <span className="h-3 w-3 rounded-full bg-emerald-400" />
        <div className="ml-3 flex-1 rounded bg-slate-700 px-3 py-1 text-xs text-slate-400">
          bubuanzeigen.de/dashboard
        </div>
      </div>
      {/* Fake sidebar + content */}
      <div className="flex" style={{ minHeight: "260px" }}>
        {/* Sidebar */}
        <div className="hidden w-44 flex-shrink-0 border-r border-slate-700 p-3 sm:block">
          <div className="mb-4 px-2 py-1">
            <div className="h-3 w-28 rounded bg-slate-600" />
            <div className="mt-1 h-2 w-20 rounded bg-slate-700" />
          </div>
          {["Dashboard", "Inserate", "Nachrichten", "Konten"].map((label) => (
            <div
              key={label}
              className="mb-1 flex items-center gap-2 rounded-lg px-2 py-2"
              style={{ background: label === "Dashboard" ? "#1e3a5f" : "transparent" }}
            >
              <div className="h-3 w-3 rounded bg-slate-600" />
              <span className="text-xs" style={{ color: label === "Dashboard" ? "#93c5fd" : "#64748b" }}>
                {label}
              </span>
            </div>
          ))}
        </div>
        {/* Main content */}
        <div className="flex-1 p-4">
          <div className="mb-3 h-4 w-32 rounded bg-slate-600" />
          {/* Stats row */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Konten", val: "3" },
              { label: "Listings", val: "47" },
              { label: "Nachrichten", val: "12" },
              { label: "Views", val: "1.8k" },
            ].map(({ label, val }) => (
              <div key={label} className="rounded-lg p-3" style={{ background: "#0f172a" }}>
                <div className="text-xs text-slate-500">{label}</div>
                <div className="mt-1 text-xl font-bold text-white">{val}</div>
              </div>
            ))}
          </div>
          {/* Fake listing rows */}
          {[
            { title: "iPhone 14 Pro — wie neu", price: "750 €", status: "Aktiv", views: "342" },
            { title: "IKEA Kallax Regal weiß", price: "45 €", status: "Aktiv", views: "89" },
            { title: "Mountainbike Cube Aim", price: "380 €", status: "Aktiv", views: "215" },
          ].map((row) => (
            <div
              key={row.title}
              className="mb-2 flex items-center justify-between rounded-lg px-3 py-2"
              style={{ background: "#0f172a" }}
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-slate-200">{row.title}</div>
                <div className="text-xs text-slate-500">{row.price} · {row.views} Views</div>
              </div>
              <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "#14532d", color: "#86efac" }}>
                {row.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────

export default function LandingPage() {
  const { user, loading } = useAuth();

  // Redirect logged-in users directly to dashboard
  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900">

      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              B
            </div>
            <span className="text-base font-bold text-slate-900">BubuKleinanzeigen</span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-3">
            <a href="#features" className="hidden text-sm text-slate-500 hover:text-slate-900 transition-colors sm:block">
              Features
            </a>
            <a href="#pricing" className="hidden text-sm text-slate-500 hover:text-slate-900 transition-colors sm:block">
              Preise
            </a>
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5">
              Anmelden
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Kostenlos starten
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 px-4 py-20 md:py-28">
        {/* Background gradient */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(37,99,235,0.35) 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-800 bg-blue-950 px-4 py-1.5 text-xs font-medium text-blue-300">
              {'✨'} Jetzt kostenlos — kein Abo nötig
            </div>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
              Alle Kleinanzeigen-Konten.{" "}
              <span className="text-blue-400">Ein Dashboard.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">
              BubuKleinanzeigen ist die zentrale Schaltzentrale für private Händler und
              Kleinunternehmer auf Kleinanzeigen.de. Verwalte mehrere Konten, beantworte
              Nachrichten und behalte alle Inserate im Blick — von überall, auf jedem Gerät.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 transition-colors"
              >
                Jetzt kostenlos starten
                <span className="text-blue-300">{'→'}</span>
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-7 py-3.5 text-base font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Features ansehen
              </a>
            </div>
          </div>

          {/* Product mockup */}
          <div className="mx-auto mt-14 max-w-4xl px-2">
            <ProductMockup />
          </div>
        </div>
      </section>

      {/* ── Trust bar ───────────────────────────────────────── */}
      <section className="border-b border-slate-100 bg-slate-50 px-4 py-4">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm font-medium text-slate-500">
          <span>{'✓'} Kostenlos starten</span>
          <span>{'✓'} Keine Kreditkarte nötig</span>
          <span>{'✓'} Setup in unter 5 Minuten</span>
          <span>{'✓'} Monatlich kündbar</span>
          <span>{'✓'} DSGVO-konform</span>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section id="features" className="px-4 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">Features</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Alles was du für professionelles Kleinanzeigen-Management brauchst
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-200 hover:shadow-md"
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl transition group-hover:bg-blue-100">
                  {f.icon}
                </div>
                <h3 className="mb-2 text-base font-semibold text-slate-900">{f.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section className="bg-slate-950 px-4 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">So einfach geht's</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              In 3 Schritten startklar
            </h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative text-center md:text-left">
                {i < STEPS.length - 1 && (
                  <div className="absolute right-0 top-6 hidden w-1/3 border-t-2 border-dashed border-slate-700 md:block" style={{ right: "-16%" }} />
                )}
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-extrabold text-white md:mx-0">
                  {step.num}
                </div>
                <h3 className="mb-2 text-lg font-bold text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-slate-400">{step.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-900/30 hover:bg-blue-500 transition-colors"
            >
              Jetzt kostenlos registrieren
              <span className="text-blue-300">{'→'}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────── */}
      <section id="pricing" className="px-4 py-20 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">Preise</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Transparent und fair
            </h2>
            <p className="mt-4 text-base text-slate-500">
              Starte kostenlos, upgrade wenn du wächst. Keine versteckten Kosten.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={[
                  "relative flex flex-col rounded-2xl border-2 p-6 transition",
                  plan.highlight
                    ? "border-blue-500 bg-blue-50 shadow-xl shadow-blue-100"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md",
                ].join(" ")}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-bold text-white shadow">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-5">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{plan.name}</p>
                  <p className="mt-2 text-4xl font-extrabold text-slate-900">
                    {plan.price}
                    <span className="text-base font-normal text-slate-400">€</span>
                    {plan.price !== "0" && (
                      <span className="text-sm font-normal text-slate-400">/Monat</span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {plan.accounts} Konto{plan.accounts > 1 ? "s" : ""}
                  </p>
                </div>

                <ul className="mb-6 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="mt-0.5 shrink-0 text-emerald-500 font-bold">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  to="/register"
                  className={[
                    "block w-full rounded-xl py-2.5 text-center text-sm font-bold transition",
                    plan.highlight
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : plan.price === "0"
                      ? "border-2 border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                      : "bg-slate-900 text-white hover:bg-slate-700",
                  ].join(" ")}
                >
                  {plan.price === "0" ? "Kostenlos starten" : `${plan.name} wählen`}
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-slate-400">
            Alle Preise inkl. MwSt. · Monatlich kündbar · Zahlung sicher über Stripe
          </p>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section className="border-t border-slate-100 bg-slate-50 px-4 py-20 md:py-24">
        <div className="mx-auto max-w-2xl">
          <div className="mb-10 text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">FAQ</p>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Häufige Fragen
            </h2>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-6 shadow-sm">
            {FAQS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────── */}
      <section className="bg-blue-600 px-4 py-20 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Bereit loszulegen?
          </h2>
          <p className="mt-4 text-lg text-blue-100">
            Starte heute kostenlos. Kein Abo, keine Kreditkarte.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-3.5 text-base font-bold text-blue-700 shadow-lg hover:bg-blue-50 transition-colors"
            >
              Jetzt kostenlos starten
              <span>{'→'}</span>
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl border-2 border-blue-400 px-8 py-3.5 text-base font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              Bereits registriert? Anmelden
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white px-4 py-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                B
              </div>
              <span className="text-sm font-semibold text-slate-700">BubuKleinanzeigen</span>
            </div>
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
              <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
              <a href="#pricing" className="hover:text-slate-900 transition-colors">Preise</a>
              <Link to="/impressum" className="hover:text-slate-900 transition-colors">Impressum</Link>
              <Link to="/datenschutz" className="hover:text-slate-900 transition-colors">Datenschutz</Link>
              <Link to="/agb" className="hover:text-slate-900 transition-colors">AGB</Link>
            </nav>
            <p className="text-xs text-slate-400">
              {'©'} {new Date().getFullYear()} BubuKleinanzeigen
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
