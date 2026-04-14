import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || "Registrierung fehlgeschlagen.";
}

export default function RegisterPage() {
  const { register, user, loading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!loading && user) { return <Navigate to="/dashboard" replace />; }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password !== passwordConfirm) { setError("Die Passw\u00f6rter stimmen nicht \u00fcberein."); return; }
    setError(""); setSubmitting(true);
    try { await register(email, password, name); }
    catch (submitError) { setError(getErrorMessage(submitError)); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-6">
      <div className="w-full max-w-md">
        <div className="card p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">Registrieren</h1>
            <p className="mt-2 text-sm text-slate-500">Erstelle dein Konto. Nach der Registrierung wirst du direkt eingeloggt.</p>
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="label">Name (optional)</label>
              <input id="name" type="text" className="input" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Chef" />
            </div>
            <div>
              <label htmlFor="email" className="label">E-Mail</label>
              <input id="email" type="email" className="input" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="chef@example.com" required />
            </div>
            <div>
              <label htmlFor="password" className="label">Passwort</label>
              <input id="password" type="password" className="input" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mindestens 8 Zeichen" minLength={8} required />
            </div>
            <div>
              <label htmlFor="password-confirm" className="label">Passwort wiederholen</label>
              <input id="password-confirm" type="password" className="input" autoComplete="new-password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="Passwort wiederholen" minLength={8} required />
            </div>
            {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? "Registrierung l\u00e4uft..." : "Konto erstellen"}
            </button>
          </form>
          <div className="mt-6 text-sm text-slate-500">
            Bereits registriert?{" "}
            <Link className="font-medium text-blue-600 hover:text-blue-700" to="/login">Zur Anmeldung</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
