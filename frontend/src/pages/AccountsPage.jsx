import { useState } from "react";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import Modal from "../components/Modal";

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || "Aktion fehlgeschlagen.";
}

function formatPlan(plan) {
  if (!plan) return "—";
  return String(plan).charAt(0).toUpperCase() + String(plan).slice(1);
}

function formatStatus(status) {
  if (!status) return "Unbekannt";
  if (status === "pending_login") return "Login ausstehend";
  if (status === "active") return "Aktiv";
  if (status === "session_expired") return "Session abgelaufen";
  if (status === "banned") return "Gesperrt";
  if (status === "disabled") return "Deaktiviert";
  return String(status).replaceAll("_", " ");
}

function getStatusBadgeClass(status) {
  if (status === "active") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  if (status === "pending_login") return "bg-amber-100 text-amber-700 border border-amber-200";
  if (status === "session_expired") return "bg-red-100 text-red-700 border border-red-200";
  if (status === "disabled") return "bg-slate-200 text-slate-700 border border-slate-300";
  if (status === "banned") return "bg-red-100 text-red-700 border border-red-200";
  return "bg-slate-100 text-slate-700 border border-slate-200";
}

function formatDate(value) {
  if (!value) return "Noch nie";
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

export default function AccountsPage() {
  const { user, refreshUser } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [loginStartingId, setLoginStartingId] = useState(null);
  const [refreshingId, setRefreshingId] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    setPageError("");
    try {
      const response = await api.get("/ka-accounts");
      setAccounts(response.data);
      await refreshUser();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoadingAccounts(false);
    }
  };

  if (!loaded) {
    setLoaded(true);
    loadAccounts();
  }

  const closeModal = () => {
    setModalOpen(false);
    setLabel("");
    setFormError("");
    setSaving(false);
  };

  const handleCreateAccount = async (event) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const response = await api.post("/ka-accounts", { label });
      setAccounts((current) => [...current, response.data]);
      await refreshUser();
      closeModal();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (accountId) => {
    setDeletingId(accountId);
    setPageError("");
    setPageNotice("");
    try {
      await api.delete(`/ka-accounts/${accountId}`);
      setAccounts((current) => current.filter((account) => account.id !== accountId));
      await refreshUser();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartLogin = async (accountId) => {
    setLoginStartingId(accountId);
    setPageError("");
    setPageNotice("");
    try {
      await api.post(`/ka-accounts/${accountId}/start-login`);
      setPageNotice("Login-Job gestartet. Sichtbarer Browser läuft über den Host-Login-Prozess.");
      await loadAccounts();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoginStartingId(null);
    }
  };

  const handleRefreshAccount = async (accountId) => {
    setRefreshingId(accountId);
    setPageError("");
    setPageNotice("");
    try {
      await api.post(`/ka-accounts/${accountId}/refresh`);
      setPageNotice("Refresh-Job gestartet. Listings werden im Hintergrund aktualisiert.");
      await loadAccounts();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setRefreshingId(null);
    }
  };

  const handleVerifyAccount = async (accountId) => {
    setVerifyingId(accountId);
    setPageError("");
    setPageNotice("");
    try {
      await api.post(`/ka-accounts/${accountId}/verify`);
      setPageNotice("Session-Prüfung gestartet.");
      await loadAccounts();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setVerifyingId(null);
    }
  };

  const totalListings = accounts.reduce((sum, account) => sum + Number(account.listing_count || 0), 0);

  return (
    <>
      <div className="space-y-4">
        <section className="card">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Konten</h1>
              <p className="mt-2 text-sm text-slate-500">
                Starte hier den Login für neue Konten, prüfe Sessions und lade Inserate neu.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" className="btn-secondary" onClick={loadAccounts} disabled={loadingAccounts}>
                {loadingAccounts ? "Lädt..." : "Neu laden"}
              </button>
              <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
                {"⚙️"} Konto hinzufügen
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Plan</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{formatPlan(user?.plan)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Account-Limit</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{user?.account_limit ?? 0}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Konten</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{loadingAccounts ? "…" : accounts.length}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Listings gesamt</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{loadingAccounts ? "…" : totalListings}</div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Verbundene Konten</h2>
              <p className="mt-1 text-sm text-slate-500">Status, Fehler und Listing-Anzahl kommen direkt aus dem Backend.</p>
            </div>
          </div>

          {pageError ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{pageError}</div>
          ) : null}

          {pageNotice ? (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{pageNotice}</div>
          ) : null}

          {loadingAccounts ? (
            <div className="mt-4 space-y-3">
              <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : null}

          {!loadingAccounts && accounts.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
              <div className="text-base font-medium text-slate-900">Noch keine Konten vorhanden</div>
              <p className="mt-2 text-sm text-slate-500">
                Lege zuerst ein Konto an. Danach kannst du den Login starten und später die Listings abrufen.
              </p>
            </div>
          ) : null}

          {!loadingAccounts && accounts.length > 0 ? (
            <div className="mt-4 space-y-3">
              {accounts.map((account) => (
                <div key={account.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-medium text-slate-900">{account.label}</h3>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(account.status)}`}>
                          {formatStatus(account.status)}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2 lg:grid-cols-3">
                        <div>Status: {formatStatus(account.status)}</div>
                        <div>Erstellt: {formatDate(account.created_at)}</div>
                        <div>Letzter Sync: {formatDate(account.last_scraped_at)}</div>
                        <div>Benutzername: {account.kleinanzeigen_user_name || "Noch nicht verknüpft"}</div>
                        <div>Listings: {account.listing_count || 0}</div>
                        <div>ID: {account.id}</div>
                      </div>

                      {account.last_error ? (
                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                          {account.last_error}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {account.status === "pending_login" ? (
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={loginStartingId === account.id}
                          onClick={() => handleStartLogin(account.id)}
                        >
                          {loginStartingId === account.id ? "Startet..." : "Login starten"}
                        </button>
                      ) : null}

                      {account.status === "active" ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={refreshingId === account.id}
                          onClick={() => handleRefreshAccount(account.id)}
                        >
                          {refreshingId === account.id ? "Lädt..." : "Neu laden"}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={verifyingId === account.id}
                        onClick={() => handleVerifyAccount(account.id)}
                      >
                        {verifyingId === account.id ? "Prüft..." : "Session prüfen"}
                      </button>

                      <button
                        type="button"
                        className="btn-danger"
                        disabled={deletingId === account.id}
                        onClick={() => handleDeleteAccount(account.id)}
                      >
                        {deletingId === account.id ? "Löscht..." : "Entfernen"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Neues Konto anlegen"
        description="Das Konto wird zuerst als Platzhalter gespeichert. Danach kannst du den Login starten."
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={closeModal}>
              Abbrechen
            </button>
            <button type="submit" form="create-account-form" className="btn-primary" disabled={saving}>
              {saving ? "Speichert..." : "Konto anlegen"}
            </button>
          </div>
        }
      >
        <form id="create-account-form" className="space-y-4" onSubmit={handleCreateAccount}>
          <div>
            <label htmlFor="account-label" className="label">Label</label>
            <input
              id="account-label"
              type="text"
              className="input"
              placeholder="z. B. Shop 1"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={100}
              required
            />
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            Dein Plan: <span className="font-medium">{formatPlan(user?.plan)}</span> · Limit: <span className="font-medium">{user?.account_limit ?? 0}</span>
          </div>
          {formError ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div> : null}
        </form>
      </Modal>
    </>
  );
}
