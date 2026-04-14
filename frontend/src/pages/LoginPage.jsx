import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function getErrorMessage(error) {
  return (
    error?.response?.data?.detail ||
    error?.message ||
    "Anmeldung fehlgeschlagen."
  );
}

export default function LoginPage() {
  const location = useLocation();
  const { login, user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const redirectTo = location.state?.from?.pathname || "/dashboard";

  if (!loading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-6">
      <div className="w-full max-w-md">
        <div className="card p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">Anmelden</h1>
            <p className="mt-2 text-sm text-slate-500">
              Melde dich an, um deine verbundenen Kleinanzeigen-Konten zu verwalten.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="label">E-Mail</label>
              <input id="email" type="email" className="input" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="chef@example.com" required />
            </div>

            <div>
              <label htmlFor="password" className="label">Passwort</label>
              <input id="password" type="password" className="input" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mindestens 8 Zeichen" required />
            </div>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
            ) : null}

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? "Anmeldung l\u00e4uft..." : "Anmelden"}
            </button>
          </form>

          <div className="mt-6 text-sm text-slate-500">
            Noch kein Konto?{" "}
            <Link className="font-medium text-blue-600 hover:text-blue-700" to="/register">Jetzt registrieren</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
