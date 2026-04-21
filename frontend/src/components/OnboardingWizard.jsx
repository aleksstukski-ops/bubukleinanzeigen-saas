import { useState } from "react";
import api from "../lib/api";

const STORAGE_KEY = "bubu_onboarding";

export function markOnboardingDone() {
  localStorage.setItem(STORAGE_KEY, "done");
}

export function needsOnboarding() {
  // Only show wizard when explicitly triggered after registration ("pending").
  // Absence of the key (existing users, first login) must NOT show the wizard.
  return localStorage.getItem(STORAGE_KEY) === "pending";
}

function Step0CreateAccount({ onNext }) {
  const [label, setLabel] = useState("Mein Konto");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await api.post("/ka-accounts", { label });
      onNext(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Fehler beim Anlegen.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="onboarding-label">Konto-Label</label>
        <input
          id="onboarding-label"
          type="text"
          className="input"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="z. B. Privat oder Shop 1"
          maxLength={100}
          required
        />
        <p className="mt-1 text-xs text-slate-500">Nur intern sichtbar — hilft dir mehrere Konten auseinanderzuhalten.</p>
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}
      <button type="submit" className="btn-primary w-full" disabled={saving}>
        {saving ? "Anlegen..." : "Konto anlegen & weiter"}
      </button>
    </form>
  );
}

function Step1LoginInstructions({ account, onNext }) {
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-800">{"🔐"} So startest du den Login:</p>
        <ol className="mt-3 space-y-2 text-sm text-amber-700">
          <li>{"1."} Gehe zur Seite <span className="font-semibold">Konten</span></li>
          <li>{"2."} Klicke auf <span className="font-semibold">Login starten</span> bei deinem Konto</li>
          <li>{"3."} Ein sichtbarer Browser auf dem Server wird gestartet — melde dich dort bei Kleinanzeigen.de an</li>
          <li>{"4."} Der Status wechselt automatisch auf <span className="font-semibold">Aktiv</span></li>
        </ol>
      </div>
      {account && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          {"✓"} Konto <span className="font-semibold">{account.label}</span> wurde angelegt.
        </div>
      )}
      <button type="button" className="btn-primary w-full" onClick={onNext}>
        Verstanden — weiter
      </button>
    </div>
  );
}

function Step2Done({ onDone }) {
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <div className="text-4xl">{"🎉"}</div>
        <p className="mt-3 text-base font-semibold text-emerald-800">Alles eingerichtet!</p>
        <p className="mt-1 text-sm text-emerald-700">
          Gehe zu Konten, starte den Login und lass den ersten Scrape laufen.
          Deine Inserate und Nachrichten erscheinen dann automatisch.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center text-xs text-slate-500">
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-2xl">{"⚙️"}</div>
          <div className="mt-1 font-medium">Konten</div>
          <div>Login starten</div>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-2xl">{"📋"}</div>
          <div className="mt-1 font-medium">Inserate</div>
          <div>Alle auf einen Blick</div>
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-2xl">{"💬"}</div>
          <div className="mt-1 font-medium">Nachrichten</div>
          <div>Zentrale Inbox</div>
        </div>
      </div>
      <button
        type="button"
        className="btn-primary w-full"
        onClick={() => { markOnboardingDone(); onDone(); }}
      >
        Zum Dashboard
      </button>
    </div>
  );
}

const STEPS = [
  { num: 1, title: "Erstes Konto verbinden", subtitle: "Lege ein Label fest — in unter einer Minute eingerichtet." },
  { num: 2, title: "Login auf dem Server starten", subtitle: "Einmalig per Browser — danach läuft alles automatisch." },
  { num: 3, title: "Alles klar — los geht's!", subtitle: "Dein Dashboard wartet auf dich." },
];

export default function OnboardingWizard({ onDone }) {
  const [step, setStep] = useState(0);
  const [createdAccount, setCreatedAccount] = useState(null);

  const handleSkip = () => {
    markOnboardingDone();
    onDone();
  };

  const currentStep = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Progress */}
        <div className="flex justify-center gap-2 pt-6">
          {STEPS.map((s, i) => (
            <div
              key={s.num}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: i === step ? "2rem" : "0.5rem",
                background: i <= step ? "var(--accent)" : "#e2e8f0",
              }}
            />
          ))}
        </div>

        <div className="px-6 py-6">
          <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
            Schritt {currentStep.num} / {STEPS.length}
          </div>
          <h2 className="mt-2 text-xl font-bold text-slate-900">{currentStep.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{currentStep.subtitle}</p>

          {step === 0 && (
            <Step0CreateAccount onNext={(account) => { setCreatedAccount(account); setStep(1); }} />
          )}
          {step === 1 && (
            <Step1LoginInstructions account={createdAccount} onNext={() => setStep(2)} />
          )}
          {step === 2 && (
            <Step2Done onDone={onDone} />
          )}
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          <button type="button" className="text-sm text-slate-400 hover:text-slate-600 transition-colors" onClick={handleSkip}>
            Wizard überspringen
          </button>
        </div>
      </div>
    </div>
  );
}
