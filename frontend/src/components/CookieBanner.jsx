import { useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "cookie_consent";

export default function CookieBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "accepted"
  );

  if (dismissed) return null;

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setDismissed(true);
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 shadow-lg"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      role="dialog"
      aria-label="Cookie-Hinweis"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Diese Website verwendet ausschließlich technisch notwendige Cookies (Authentifizierung).
          Es werden keine Tracking- oder Werbe-Cookies eingesetzt.{" "}
          <Link to="/datenschutz" className="underline" style={{ color: "var(--accent)" }}>
            Datenschutzerklärung
          </Link>
        </p>
        <button type="button" className="btn-primary shrink-0" onClick={accept}>
          Verstanden
        </button>
      </div>
    </div>
  );
}
