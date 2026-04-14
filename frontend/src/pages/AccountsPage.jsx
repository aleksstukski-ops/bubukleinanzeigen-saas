import { useState } from "react";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import Modal from "../components/Modal";

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || "Aktion fehlgeschlagen.";
}

function formatPlan(plan) {
  if (!plan) return "\u2014";
  return String(plan).charAt(0).toUpperCase() + String(plan).slice(1);
}

function formatStatus(status) {
  if (!status) return "Unbekannt";
  return String(status).replaceAll("_", " ");
}

function formatDate(value) {
  if (!value) return "Noch nie";
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch (error) { return value; }
}

export default function AccountsPage() {
  const { user, refreshUser } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [pageError, setPageError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const loadAccounts = async () => {
    setLoadingAccounts(true); setPageError("");
    try {
      const response = await api.get("/ka-accounts");
      setAccounts(response.data);
      await refreshUser();
    } catch (error) { setPageError(getErrorMessage(error)); }
    finally { setLoadingAccounts(false); }
  };

  if (!loaded) { setLoaded(true); loadAccounts(); }

  const closeModal = () => { setModalOpen(false); setLabel(""); setFormError(""); setSaving(false); };

  const handleCreateAccount = async (event) => {
    event.preventDefault();
    setSaving(true); setFormError("");
    try {
      const response = await api.post("/ka-accounts", { label });
      setAccounts((current) => [...current, response.data]);
      await refreshUser();
      closeModal();
    } catch (error) { setFormError(getErrorMessage(error)); }
    finally { setSaving(false); }
  };

  const handleDeleteAccount = async (accountId) => {
    setDeletingId(accountId); setPageError("");
    try {
      await api.delete(`/ka-accounts/${accountId}`);
      setAccounts((current) => current.filter((account) => account.id !== accountId));
      await refreshUser();
    } catch (error) { setPageError(getErrorMessage(error)); }
    finally { setDeletingId(null); }
  };

  return (
    <>
      <div className="space-y-4">
        <section className="card">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Konten</h1>
              <p className="mt-2 text-sm text-slate-500">Verwalte hier alle angelegten Kleinanzeigen-Konten. Session 1 speichert nur Label und Status.</p>
            </div>
            <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
              {"\u2699\uFE0F"} Konto hinzuf\u00fcgen
            </button>
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
              <div className="text-sm text-slate-500">Angelegt</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{loadingAccounts ? "\u2026" : accounts.length}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Hinweis</div>
              <div className="mt-2 text-sm font-medium text-slate-900">Free erlaubt 1 Konto</div>
              <div className="mt-1 text-sm text-slate-600">Ein zweiter Versuch zeigt die Backend-Meldung direkt im UI.</div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Verbundene Konten</h2>
              <p className="mt-1 text-sm text-slate-500">Status und Zeitstempel kommen direkt aus dem Backend.</p>
            </div>
          </div>

          {pageError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{pageError}</div> : null}

          {loadingAccounts ? (
            <div className="mt-4 space-y-3">
              <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : null}

          {!loadingAccounts && accounts.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
              <div className="text-base font-medium text-slate-900">Noch keine Konten vorhanden</div>
              <p className="mt-2 text-sm text-slate-500">Klicke auf \u201eKonto hinzuf\u00fcgen\u201c und gib deinem Konto ein Label. Danach erscheint es sofort in dieser Liste.</p>
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
                        <span className="status-badge">{formatStatus(account.status)}</span>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                        <div>Status: {formatStatus(account.status)}</div>
                        <div>Erstellt: {formatDate(account.created_at)}</div>
                        <div>Letzter Sync: {formatDate(account.last_scraped_at)}</div>
                        <div>Benutzername: {account.kleinanzeigen_user_name || "Noch nicht verkn\u00fcpft"}</div>
                      </div>
                      {account.last_error ? <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{account.last_error}</div> : null}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button type="button" className="btn-danger" disabled={deletingId === account.id} onClick={() => handleDeleteAccount(account.id)}>
                        {deletingId === account.id ? "L\u00f6scht..." : "Entfernen"}
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
        description="Das Konto wird zun\u00e4chst nur lokal im Backend als Platzhalter gespeichert."
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={closeModal}>Abbrechen</button>
            <button type="submit" form="create-account-form" className="btn-primary" disabled={saving}>{saving ? "Speichert..." : "Konto anlegen"}</button>
          </div>
        }
      >
        <form id="create-account-form" className="space-y-4" onSubmit={handleCreateAccount}>
          <div>
            <label htmlFor="account-label" className="label">Label</label>
            <input id="account-label" type="text" className="input" placeholder="z. B. Shop 1" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={100} required />
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            Dein Plan: <span className="font-medium">{formatPlan(user?.plan)}</span> \u00b7 Limit: <span className="font-medium">{user?.account_limit ?? 0}</span>
          </div>
          {formError ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div> : null}
        </form>
      </Modal>
    </>
  );
}
