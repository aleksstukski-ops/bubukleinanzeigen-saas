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

const PLATFORMS = [
  { id: "kleinanzeigen", icon: "🟢", name: "Kleinanzeigen.de", available: true, tag: "Verfuegbar" },
  { id: "ebay", icon: "🔵", name: "eBay", available: false, tag: "Bald" },
  { id: "vinted", icon: "🟠", name: "Vinted", available: false, tag: "Bald" },
  { id: "etsy", icon: "🔴", name: "Etsy", available: false, tag: "Geplant" },
];

function Step0ChoosePlatform({ onNext }) {
  const [selected, setSelected] = useState("kleinanzeigen");

  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-slate-500">
        Waehle die Plattform, mit der du starten moechtest. Weitere Kanaele folgen bald.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {PLATFORMS.map((p) => {
          const isSelected = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={!p.available}
              onClick={() => { if (p.available) setSelected(p.id); }}
              className={[
                "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition",
                isSelected && p.available
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : p.available
                  ? "border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm cursor-pointer"
                  : "border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed",
              ].join(" ")}
              style={{ minHeight: "88px" }}
            >
              <span className="text-2xl">{p.icon}</span>
              <span className="text-sm font-semibold text-slate-800">{p.name}</span>
              <span
                className={[
                  "absolute -top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-bold",
                  p.available
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-200 text-slate-500",
                ].join(" ")}
              >
                {p.tag}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="btn-primary w-full"
        onClick={() => onNext(selected)}
      >
        Weiter mit {PLATFORMS.find((p) => p.id === selected)?.name || ""}
      </button>
    </div>
  );
}

function Step1ConnectAccount({ platform, onNext }) {
  const [label, setLabel] = useState("Mein Konto");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);
  const [createdAccount, setCreatedAccount] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await api.post("/ka-accounts", { label });
      setCreatedAccount(res.data);
      setCreated(true);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Fehler beim Anlegen.");
    } finally {
      setSaving(false);
    }
  };

  const platformName = PLATFORMS.find((p) => p.id === platform)?.name || "Kleinanzeigen.de";

  return (
    <div className="mt-6 space-y-4">
      {!created && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-800">
              {"🔗"} {platformName} Konto verbinden
            </p>
            <p className="mt-1 text-xs text-blue-600">
              Vergib einen Namen fuer dein Konto, dann starte den sicheren Login-Prozess.
            </p>
          </div>
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
            <p className="mt-1 text-xs text-slate-500">
              Nur intern sichtbar — hilft dir mehrere Konten auseinanderzuhalten.
            </p>
          </div>
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? "Anlegen..." : "Konto anlegen"}
          </button>
        </form>
      )}

      {created && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            {"✓"} Konto wurde angelegt!
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">{"🔐"} So startest du den Login:</p>
            <ol className="mt-3 space-y-2 text-sm text-amber-700">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-800">1</span>
                <span>Gehe zur Seite <strong>Konten</strong></span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-800">2</span>
                <span>Klicke auf <strong>Login starten</strong> bei deinem Konto</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-800">3</span>
                <span>Melde dich im geoeffneten Browser bei {platformName} an</span>
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-800">4</span>
                <span>Status wechselt automatisch auf <strong>Aktiv</strong></span>
              </li>
            </ol>
          </div>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => onNext(createdAccount)}
          >
            Weiter
          </button>
        </div>
      )}
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
          Starte den Login auf der Konten-Seite. Danach werden deine Inserate
          und Nachrichten automatisch synchronisiert.
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
  { num: 1, title: "Waehle deine Plattform", subtitle: "Starte mit Kleinanzeigen.de — weitere Kanaele folgen bald." },
  { num: 2, title: "Konto verbinden", subtitle: "Lege ein Label fest und starte den sicheren Login-Prozess." },
  { num: 3, title: "Fertig — dein Dashboard", subtitle: "Alles ist bereit. Los geht's!" },
];

export default function OnboardingWizard({ onDone }) {
  const [step, setStep] = useState(0);
  const [selectedPlatform, setSelectedPlatform] = useState("kleinanzeigen");

  const handleSkip = () => {
    markOnboardingDone();
    onDone();
  };

  const currentStep = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl" style={{ maxHeight: "90dvh", overflowY: "auto" }}>
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
            <Step0ChoosePlatform onNext={(platform) => { setSelectedPlatform(platform); setStep(1); }} />
          )}
          {step === 1 && (
            <Step1ConnectAccount
              platform={selectedPlatform}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <Step2Done onDone={onDone} />
          )}
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          <button type="button" className="text-sm text-slate-400 hover:text-slate-600 transition-colors" onClick={handleSkip}>
            Wizard ueberspringen
          </button>
        </div>
      </div>
    </div>
  );
}
