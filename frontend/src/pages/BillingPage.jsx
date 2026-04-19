import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import api from "../lib/api";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "0",
    period: "",
    accounts: 1,
    features: ["1 Kleinanzeigen-Konto", "Inserate & Nachrichten verwalten"],
    cta: null,
    highlight: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: "9",
    period: "/Monat",
    accounts: 1,
    features: ["1 Kleinanzeigen-Konto", "Inserate & Nachrichten verwalten", "Prioritäts-Support"],
    cta: "Upgrade auf Starter",
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "19",
    period: "/Monat",
    accounts: 3,
    features: ["3 Kleinanzeigen-Konten", "Alle Starter-Features", "Bulk-Aktionen"],
    cta: "Upgrade auf Pro",
    highlight: true,
  },
  {
    id: "business",
    name: "Business",
    price: "39",
    period: "/Monat",
    accounts: 10,
    features: ["10 Kleinanzeigen-Konten", "Alle Pro-Features", "Dedizierter Support"],
    cta: "Upgrade auf Business",
    highlight: false,
  },
];

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || "Aktion fehlgeschlagen.";
}

function SuccessBanner({ plan, onDismiss }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div>
        <p className="font-semibold text-emerald-800">{'🎉'} Abonnement aktiviert!</p>
        <p className="mt-0.5 text-sm text-emerald-700">
          Du bist jetzt auf dem {String(plan).charAt(0).toUpperCase() + String(plan).slice(1)}-Plan.
        </p>
      </div>
      <button type="button" onClick={onDismiss} className="text-emerald-600 hover:text-emerald-800 text-lg leading-none">
        {'×'}
      </button>
    </div>
  );
}

function CancelledBanner({ onDismiss }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-sm text-slate-600">{'ℹ️'} Checkout abgebrochen — kein Abonnement wurde geändert.</p>
      <button type="button" onClick={onDismiss} className="text-slate-400 hover:text-slate-600 text-lg leading-none">
        {'×'}
      </button>
    </div>
  );
}

export default function BillingPage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(null); // plan id being loaded
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
      // Clear URL params without navigation
      window.history.replaceState({}, "", "/billing");
      refreshUser();
    } else if (params.get("cancelled") === "1") {
      setShowCancelled(true);
      window.history.replaceState({}, "", "/billing");
    }
  }

  const currentPlan = user?.plan || "free";
  const isSubscribed = user?.subscription_status === "active";

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

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Abrechnung</h1>
        <p className="mt-1 text-sm text-slate-500">
          Aktueller Plan: <span className="font-semibold text-slate-700">
            {String(currentPlan).charAt(0).toUpperCase() + String(currentPlan).slice(1)}
          </span>
          {isSubscribed && (
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {'✓'} Aktiv
            </span>
          )}
        </p>
      </div>

      {successPlan && (
        <SuccessBanner plan={successPlan} onDismiss={() => setSuccessPlan(null)} />
      )}
      {showCancelled && (
        <CancelledBanner onDismiss={() => setShowCancelled(false)} />
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isDowngrade = PLANS.findIndex(p => p.id === plan.id) < PLANS.findIndex(p => p.id === currentPlan);

          const isClickable = plan.cta && !isCurrent && !isDowngrade;

          return (
            <div
              key={plan.id}
              onClick={isClickable ? () => handleUpgrade(plan.id) : undefined}
              className={[
                "relative flex flex-col rounded-xl border-2 p-5 transition hover:border-blue-400 hover:shadow-lg",
                plan.highlight
                  ? "border-blue-300 bg-blue-50 ring-2 ring-blue-200"
                  : "border-slate-300 bg-white",
                isCurrent ? "ring-2 ring-emerald-300 border-emerald-300" : "",
                isClickable ? "cursor-pointer active:scale-[0.99]" : "",
              ].join(" ")}
            >
              {plan.highlight && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Beliebt
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Aktuell
                </div>
              )}

              <div className="mb-4">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{plan.name}</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">
                  {plan.price}{'€'}
                  <span className="text-sm font-normal text-slate-500">{plan.period}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">{plan.accounts} Konto{plan.accounts > 1 ? 's' : ''}</p>
              </div>

              <ul className="mb-5 flex-1 space-y-2">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-0.5 shrink-0 text-emerald-500">{'✓'}</span>
                    {f}
                  </li>
                ))}
              </ul>

              {plan.cta && !isCurrent && !isDowngrade && (
                <button
                  type="button"
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={loading === plan.id}
                  className={[
                    "w-full rounded-lg px-4 py-2 text-sm font-semibold transition",
                    plan.highlight
                      ? "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                      : "bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-60",
                  ].join(" ")}
                >
                  {loading === plan.id ? "Wird geladen..." : plan.cta}
                </button>
              )}

              {isCurrent && plan.id !== "free" && (
                <p className="text-center text-xs text-emerald-600 font-medium">Dein Plan</p>
              )}

              {isCurrent && plan.id === "free" && (
                <p className="text-center text-xs text-slate-400">Kostenlos</p>
              )}
            </div>
          );
        })}
      </div>

      {isSubscribed && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700">Abonnement verwalten</h2>
          <p className="mt-1 text-sm text-slate-500">
            Zahlungsmethode ändern, Rechnungen herunterladen oder Abo kündigen.
          </p>
          <button
            type="button"
            onClick={handlePortal}
            disabled={portalLoading}
            className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {portalLoading ? "Wird geöffnet..." : "Stripe-Kundenportal öffnen"}
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-slate-400">
        Alle Preise inkl. MwSt. {'·'} Monatlich kündbar {'·'} Zahlung über Stripe
      </p>
    </div>
  );
}
