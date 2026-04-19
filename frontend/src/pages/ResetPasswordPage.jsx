import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../lib/api";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { token, password });
      setSuccess(true);
    } catch (err) {
      setError(err?.response?.data?.detail || "Fehler beim Zurücksetzen.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-6">
        <div className="card p-6 text-center">
          <p className="text-slate-700">Ungültiger Link. Fordere einen neuen an.</p>
          <Link className="mt-4 inline-block font-medium text-blue-600" to="/forgot-password">Neuen Link anfordern</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-6">
      <div className="w-full max-w-md">
        <div className="card p-6 md:p-8">
          <h1 className="text-2xl font-semibold text-slate-900">Neues Passwort setzen</h1>

          {success ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">Passwort wurde geändert.</div>
              <Link className="btn-primary inline-block w-full text-center" to="/login">Zum Login</Link>
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="new-password" className="label">Neues Passwort</label>
                <input id="new-password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mindestens 8 Zeichen" minLength={8} required />
              </div>
              {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}
              <button type="submit" className="btn-primary w-full" disabled={submitting}>{submitting ? "Speichert..." : "Passwort ändern"}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
