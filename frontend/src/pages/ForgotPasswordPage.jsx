import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(err?.response?.data?.detail || "Fehler beim Senden.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-6">
      <div className="w-full max-w-md">
        <div className="card p-6 md:p-8">
          <h1 className="text-2xl font-semibold text-slate-900">Passwort vergessen</h1>
          <p className="mt-2 text-sm text-slate-500">Gib deine E-Mail ein. Du bekommst einen Link zum Zurücksetzen.</p>

          {sent ? (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
              Falls ein Konto mit dieser E-Mail existiert, wurde ein Link gesendet. Prüfe dein Postfach.
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="reset-email" className="label">E-Mail</label>
                <input id="reset-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="chef@example.com" required />
              </div>
              {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
              <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting ? "Sendet..." : "Link senden"}</button>
            </form>
          )}

          <div className="mt-6 text-sm text-slate-500">
            <Link className="font-medium text-blue-600 hover:text-blue-700" to="/login">Zurück zum Login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
