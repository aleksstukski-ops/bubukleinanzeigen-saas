import { useState } from "react";
import { Link } from "react-router-dom";
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

  const activeAccounts = accounts.filter((account) => account.status === "active").length;
  const pendingAccounts = accounts.filter((account) => account.status === "pending_login").length;
  const expiredAccounts = accounts.filter((account) => account.status === "session_expired").length;
  const totalListings = accounts.reduce((sum, account) => sum + Number(account.listing_count || 0), 0);

  return (
    <>
      <div className="space-y-4">
        <section className="card">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Übersicht</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Hier siehst du Kontostatus und die Gesamtzahl deiner gespeicherten Listings über alle Accounts.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link className="btn-secondary" to="/accounts">Konten verwalten</Link>
              <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
                {"⚙️"} Konto hinzufügen
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Verbundene Konten</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{loadingAccounts ? "…" : accounts.length}</div>
              <div className="mt-2 text-sm text-slate-600">Aktiv: {activeAccounts}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Listings gesamt</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{loadingAccounts ? "…" : totalListings}</div>
              <div className="mt-2 text-sm text-slate-600">Über alle Accounts</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Aktiver Plan</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{formatPlan(user?.plan)}</div>
              <div className="mt-2 text-sm text-slate-600">Limit: {user?.account_limit ?? 0} Konto{user?.account_limit === 1 ? "" : "en"}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Offene Aktionen</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">{pendingAccounts} Login ausstehend</div>
              <div className="mt-2 text-sm text-slate-600">{expiredAccounts} Sessions abgelaufen</div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Konten im Überblick</h2>
              <p className="mt-1 text-sm text-slate-500">Nutze die Kontenseite für Login-Start, Refresh und Session-Prüfung.</p>
            </div>
            <Link className="btn-secondary" to="/accounts">Zu den Konten</Link>
          </div>

          {pageError ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{pageError}</div>
          ) : null}

          {loadingAccounts ? (
            <div className="mt-4 space-y-3">
              <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : null}

          {!loadingAccounts && accounts.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
              <div className="text-base font-medium text-slate-900">Noch keine Konten verbunden</div>
              <p className="mt-2 text-sm text-slate-500">
                Lege jetzt ein erstes Konto an. Danach kannst du auf der Kontenseite den Login starten.
              </p>
            </div>
          ) : null}

          {!loadingAccounts && accounts.length > 0 ? (
            <div className="mt-4 space-y-3">
              {accounts.map((account) => (
                <div key={account.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-medium text-slate-900">{account.label}</div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(account.status)}`}>
                        {formatStatus(account.status)}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-sm text-slate-500 sm:grid-cols-2">
                      <div>Benutzername: {account.kleinanzeigen_user_name || "Noch nicht verknüpft"}</div>
                      <div>Listings: {account.listing_count || 0}</div>
                    </div>
                    {account.last_error ? (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                        {account.last_error}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Link className="btn-secondary" to="/accounts">Account öffnen</Link>
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
        title="Konto hinzufügen"
        description="Vergib zuerst ein internes Label. Danach kannst du den Login starten."
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={closeModal}>Abbrechen</button>
            <button type="submit" form="create-account-form-dashboard" className="btn-primary" disabled={saving}>
              {saving ? "Speichert..." : "Konto anlegen"}
            </button>
          </div>
        }
      >
        <form id="create-account-form-dashboard" className="space-y-4" onSubmit={handleCreateAccount}>
          <div>
            <label htmlFor="dashboard-account-label" className="label">Label</label>
            <input
              id="dashboard-account-label"
              type="text"
              className="input"
              placeholder="z. B. Privat"
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
