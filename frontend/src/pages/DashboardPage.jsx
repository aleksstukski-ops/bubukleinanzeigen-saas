import { useState } from "react";
import { Link } from "react-router-dom";
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

export default function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [pageError, setPageError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

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

  return (
    <>
      <div className="space-y-4">
        <section className="card">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">\u00dcbersicht</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Willkommen im Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Hier siehst du den aktuellen Stand deiner verbundenen Konten. Der echte Kleinanzeigen-Login kommt erst in Session 2.
              </p>
            </div>
            <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
              {"\u2699\uFE0F"} Konto hinzuf\u00fcgen
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Verbundene Konten</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{loadingAccounts ? "\u2026" : accounts.length}</div>
              <div className="mt-2 text-sm text-slate-600">Du hast {accounts.length} verbundene Konten</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Aktiver Plan</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{formatPlan(user?.plan)}</div>
              <div className="mt-2 text-sm text-slate-600">Limit: {user?.account_limit ?? 0} Konto{user?.account_limit === 1 ? "" : "en"}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">N\u00e4chster Schritt</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">Konto verbinden</div>
              <div className="mt-2 text-sm text-slate-600">Lege jetzt dein erstes Konto an und gib ihm ein internes Label.</div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Konto-Status</h2>
              <p className="mt-1 text-sm text-slate-500">Free erlaubt aktuell 1 Konto. Ein zweites Konto wird serverseitig blockiert.</p>
            </div>
            <Link className="btn-secondary" to="/accounts">Konten verwalten</Link>
          </div>

          {pageError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{pageError}</div> : null}

          {loadingAccounts ? (
            <div className="mt-4 space-y-3">
              <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : null}

          {!loadingAccounts && accounts.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
              <div className="text-base font-medium text-slate-900">Noch keine Konten verbunden</div>
              <p className="mt-2 text-sm text-slate-500">Lege jetzt ein erstes Konto mit einem frei w\u00e4hlbaren Label an, zum Beispiel \u201ePrivat\u201c, \u201eShop 1\u201c oder \u201eLager Nord\u201c.</p>
            </div>
          ) : null}

          {!loadingAccounts && accounts.length > 0 ? (
            <div className="mt-4 space-y-3">
              {accounts.map((account) => (
                <div key={account.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-base font-medium text-slate-900">{account.label}</div>
                    <div className="mt-1 text-sm text-slate-500">Status: {formatStatus(account.status)}</div>
                  </div>
                  <span className="status-badge">{formatStatus(account.status)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Konto hinzuf\u00fcgen"
        description="Vergib zuerst ein internes Label. Der echte Login folgt in Session 2."
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={closeModal}>Abbrechen</button>
            <button type="submit" form="create-account-form-dashboard" className="btn-primary" disabled={saving}>{saving ? "Speichert..." : "Konto anlegen"}</button>
          </div>
        }
      >
        <form id="create-account-form-dashboard" className="space-y-4" onSubmit={handleCreateAccount}>
          <div>
            <label htmlFor="dashboard-account-label" className="label">Label</label>
            <input id="dashboard-account-label" type="text" className="input" placeholder="z. B. Privat" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={100} required />
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
