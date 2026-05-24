import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import api from "../lib/api";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    accounts: 1,
    tagline: "Kostenlos testen",
    cta: null,
    highlight: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: 9,
    accounts: 1,
    tagline: "Fuer Einsteiger",
    cta: "Upgrade auf Starter",
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 19,
    accounts: 3,
    tagline: "Fuer Power-User",
    cta: "Upgrade auf Pro",
    highlight: true,
  },
  {
    id: "business",
    name: "Business",
    price: 39,
    accounts: 10,
    tagline: "Fuer Profi-Verkaeufer",
    cta: "Upgrade auf Business",
    highlight: false,
  },
];

// Comparison rows: which plans include which feature. true = full check,
// string = scoped value (e.g. "1", "3", "10"). false = missing.
const FEATURE_ROWS = [
  { label: "Verkaufskonten", free: "1", starter: "1", pro: "3", business: "10" },
  { label: "Inserate & Nachrichten", free: true, starter: true, pro: true, business: true },
  { label: "Auto-Bump (1/2/3/5/7/14 Tage)", free: true, starter: true, pro: true, business: true },
  { label: "Inline Preis & Beschreibung", free: true, starter: true, pro: true, business: true },
  { label: "Push-Notifications", free: true, starter: true, pro: true, business: true },
  { label: "Vorlagen mit Platzhaltern", free: false, starter: true, pro: true, business: true },
  { label: "CSV-Import (bis 30 Inserate)", free: false, starter: false, pro: true, business: true },
  { label: "Bulk-Aktionen (Preis/Loeschen/Bump)", free: false, starter: false, pro: true, business: true },
  { label: "Auto-Antworten", free: false, starter: false, pro: true, business: true },
  { label: "Kategorie-Monitor", free: false, starter: false, pro: true, business: true },
  { label: "KI-Inserat-Erstellen", free: false, starter: false, pro: false, business: true },
  { label: "Prioritaets-Support", free: false, starter: true, pro: true, business: true },
  { label: "Dedizierter Support", free: false, starter: false, pro: false, business: true },
];

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || "Aktion fehlgeschlagen.";
}

function planRank(planId) {
  return PLANS.findIndex((p) => p.id === planId);
}

function FeatureCell({ value }) {
  if (value === true) {
    return <span className="text-emerald-500" aria-label="Enthalten">{"✓"}</span>;
  }
  if (value === false || value === undefined || value === null) {
    return <span className="text-slate-300 dark:text-slate-600" aria-label="Nicht enthalten">{"—"}</span>;
  }
  return <span className="font-semibold">{value}</span>;
}

function SuccessBanner({ plan, onDismiss }) {
  return (
    <div
      className="mb-6 flex items-start justify-between gap-3 rounded-lg border px-4 py-3"
      style={{ borderColor: "var(--accent)", background: "var(--accent-bg)" }}
    >
      <div>
        <p className="font-semibold" style={{ color: "var(--accent)" }}>{"🎉"} Abonnement aktiviert!</p>
        <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
          Du bist jetzt auf dem {String(plan).charAt(0).toUpperCase() + String(plan).slice(1)}-Plan.
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-lg leading-none"
        style={{ color: "var(--text-subtle)" }}
        aria-label="Schliessen"
      >
        {"×"}
      </button>
    </div>
  );
}

function CancelledBanner({ onDismiss }) {
  return (
    <div
      className="mb-6 flex items-start justify-between gap-3 rounded-lg border px-4 py-3"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {"ℹ️"} Checkout abgebrochen — kein Abonnement wurde geaendert.
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-lg leading-none"
        style={{ color: "var(--text-subtle)" }}
        aria-label="Schliessen"
      >
        {"×"}
      </button>
    </div>
  );
}

export default function BillingPage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inited, setInited] = useState(false);
  const [successPlan, setSuccessPlan] = useState(null);
  const [showCancelled, setShowCancelled] = useState(false);

  if (!inited) {
    setInited(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "1") {
      setSuccessPlan(params.get("plan") || "");
      window.history.replaceState({}, "", "/billing");
      refreshUser();
    } else if (params.get("cancelled") === "1") {
      setShowCancelled(true);
      window.history.replaceState({}, "", "/billing");
    }
  }

  const currentPlan = user?.plan || "free";
  const subscriptionStatus = user?.subscription_status || null;
  const isSubscribed = subscriptionStatus === "active";
  const isPastDue = subscriptionStatus === "past_due";
  const expiresAt = user?.subscription_expires_at ? new Date(user.subscription_expires_at) : null;
  const formattedExpiry = expiresAt && !isNaN(expiresAt.getTime())
    ? new Intl.DateTimeFormat("de-DE", { dateStyle: "long" }).format(expiresAt)
    : null;

  const handleUpgrade = async (planId) => {
    setError(null);
    setLoading(planId);
    try {
      const res = await api.post("/billing/checkout-session", { plan: planId });
      window.location.href = res.data.url;
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    setError(null);
    setPortalLoading(true);
    try {
      const res = await api.post("/billing/portal");
      window.location.href = res.data.url;
    } catch (err) {
      setError(getErrorMessage(err));
      setPortalLoading(false);
    }
  };

  const currentRank = planRank(currentPlan);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>Abrechnung & Plaene</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Aktueller Plan:{" "}
          <span className="font-semibold" style={{ color: "var(--text)" }}>
            {String(currentPlan).charAt(0).toUpperCase() + String(currentPlan).slice(1)}
          </span>
          {isSubscribed && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {"✓"} Aktiv
            </span>
          )}
          {isPastDue && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
              {"⚠️"} Zahlung fehlgeschlagen
            </span>
          )}
        </p>
        {isSubscribed && formattedExpiry && (
          <p className="mt-1 text-xs" style={{ color: "var(--text-subtle)" }}>
            Naechste Abbuchung: {formattedExpiry}
          </p>
        )}
        {isPastDue && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Bitte Zahlungsmethode im Stripe-Kundenportal aktualisieren.
          </p>
        )}
      </header>

      {successPlan && <SuccessBanner plan={successPlan} onDismiss={() => setSuccessPlan(null)} />}
      {showCancelled && <CancelledBanner onDismiss={() => setShowCancelled(false)} />}
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Plan cards — mobile-first single column, then sm:2, lg:4 */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan, index) => {
          const isCurrent = currentPlan === plan.id;
          const isDowngrade = index < currentRank;
          const isClickable = plan.cta && !isCurrent && !isDowngrade;
          const isLoading = loading === plan.id;

          return (
            <div
              key={plan.id}
              className={[
                "relative flex flex-col rounded-2xl border p-5 transition",
                plan.highlight ? "shadow-lg" : "",
                isClickable ? "hover:-translate-y-0.5 hover:shadow-xl" : "",
              ].join(" ")}
              style={{
                background: plan.highlight ? "var(--accent-bg)" : "var(--surface)",
                borderColor: isCurrent
                  ? "rgb(16 185 129)"
                  : plan.highlight
                    ? "var(--accent)"
                    : "var(--border)",
                borderWidth: isCurrent || plan.highlight ? "2px" : "1px",
              }}
            >
              {plan.highlight && !isCurrent && (
                <span
                  className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold text-white shadow"
                  style={{ background: "var(--accent)" }}
                >
                  {"⭐"} Beliebtester Plan
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-semibold text-white shadow">
                  {"✓"} Aktueller Plan
                </span>
              )}

              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-subtle)" }}>
                  {plan.tagline}
                </p>
                <p className="mt-1 text-lg font-semibold" style={{ color: "var(--text)" }}>
                  {plan.name}
                </p>
                <p className="mt-3 flex items-baseline gap-1" style={{ color: "var(--text)" }}>
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-xl font-semibold">{"€"}</span>
                  <span className="text-sm font-normal" style={{ color: "var(--text-subtle)" }}>
                    {plan.price === 0 ? "" : "/Monat"}
                  </span>
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-subtle)" }}>
                  {plan.accounts === 1 ? "1 Verkaufskonto" : `${plan.accounts} Verkaufskonten`}
                </p>
              </div>

              <div className="mt-auto">
                {isCurrent ? (
                  <div
                    className="w-full rounded-lg border px-4 py-2 text-center text-sm font-semibold"
                    style={{ borderColor: "rgb(16 185 129)", color: "rgb(16 185 129)" }}
                  >
                    Dein Plan
                  </div>
                ) : isDowngrade ? (
                  <div
                    className="w-full rounded-lg border px-4 py-2 text-center text-sm"
                    style={{ borderColor: "var(--border)", color: "var(--text-subtle)" }}
                  >
                    Downgrade ueber Portal
                  </div>
                ) : plan.cta ? (
                  <button
                    type="button"
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isLoading}
                    className={[
                      "w-full rounded-lg px-4 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60",
                      plan.highlight ? "text-white shadow-md hover:shadow-lg" : "border",
                    ].join(" ")}
                    style={plan.highlight
                      ? { background: "var(--accent)" }
                      : { borderColor: "var(--border)", color: "var(--text)", background: "transparent" }}
                  >
                    {isLoading ? "Wird geladen..." : plan.cta}
                  </button>
                ) : (
                  <div
                    className="w-full rounded-lg border px-4 py-2 text-center text-sm"
                    style={{ borderColor: "var(--border)", color: "var(--text-subtle)" }}
                  >
                    Kostenlos
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* Feature comparison table */}
      <section
        className="overflow-hidden rounded-2xl border"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
          <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>Funktionen im Vergleich</h2>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-subtle)" }}>
            Welcher Plan enthaelt was — auf einen Blick.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr style={{ color: "var(--text-muted)", background: "var(--bg)" }}>
                <th className="sticky left-0 px-4 py-3 font-semibold" style={{ background: "var(--bg)" }}>Feature</th>
                {PLANS.map((p) => (
                  <th key={p.id} className="px-4 py-3 text-center font-semibold">
                    <div style={{ color: p.highlight ? "var(--accent)" : "var(--text-muted)" }}>
                      {p.name}
                    </div>
                    <div className="text-xs font-normal" style={{ color: "var(--text-subtle)" }}>
                      {p.price === 0 ? "Gratis" : `${p.price} EUR/Monat`}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? "" : "bg-black/[0.015] dark:bg-white/[0.02]"}>
                  <td className="px-4 py-3 font-medium" style={{ color: "var(--text)" }}>{row.label}</td>
                  <td className="px-4 py-3 text-center">
                    <FeatureCell value={row.free} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <FeatureCell value={row.starter} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <FeatureCell value={row.pro} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <FeatureCell value={row.business} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {isSubscribed && (
        <section
          className="rounded-2xl border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Abonnement verwalten</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Zahlungsmethode aendern, Rechnungen herunterladen oder Abo kuendigen.
          </p>
          <button
            type="button"
            onClick={handlePortal}
            disabled={portalLoading}
            className="mt-3 rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-black/5 active:scale-[0.98] disabled:opacity-60 dark:hover:bg-white/5"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          >
            {portalLoading ? "Wird geoeffnet..." : "Stripe-Kundenportal oeffnen"}
          </button>
        </section>
      )}

      <p className="text-center text-xs" style={{ color: "var(--text-subtle)" }}>
        Alle Preise inkl. MwSt. {"·"} Monatlich kuendbar {"·"} Zahlung ueber Stripe
      </p>
    </div>
  );
}
