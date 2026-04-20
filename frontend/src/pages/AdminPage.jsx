import { useState } from "react";
import api from "../lib/api";

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || "Fehler beim Laden.";
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-slate-900">{value ?? "…"}</div>
      {sub && <div className="mt-2 text-sm text-slate-600">{sub}</div>}
    </div>
  );
}

function StatusBadge({ value }) {
  const colors = {
    active: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    pending: "bg-amber-100 text-amber-700 border border-amber-200",
    pending_login: "bg-amber-100 text-amber-700 border border-amber-200",
    failed: "bg-red-100 text-red-700 border border-red-200",
    session_expired: "bg-red-100 text-red-700 border border-red-200",
    banned: "bg-red-100 text-red-700 border border-red-200",
    running: "bg-blue-100 text-blue-700 border border-blue-200",
    retrying: "bg-orange-100 text-orange-700 border border-orange-200",
    completed: "bg-slate-100 text-slate-600 border border-slate-200",
    disabled: "bg-slate-200 text-slate-600 border border-slate-300",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[value] || "bg-slate-100 text-slate-600 border border-slate-200"}`}>
      {value}
    </span>
  );
}

const TABS = ["Übersicht", "Nutzer", "Jobs", "Konten"];

export default function AdminPage() {
  const [tab, setTab] = useState("Übersicht");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [jobStatus, setJobStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inited, setInited] = useState(false);

  if (!inited) {
    setInited(true);
    loadStats();
  }

  async function loadStats() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/stats");
      setStats(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadUsers() {
    if (users !== null) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/users");
      setUsers(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadJobs(status = "") {
    setLoading(true);
    setError("");
    try {
      const params = status ? { status } : {};
      const { data } = await api.get("/admin/jobs", { params });
      setJobs(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadAccounts() {
    if (accounts !== null) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/accounts");
      setAccounts(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleTabChange(t) {
    setTab(t);
    if (t === "Nutzer") loadUsers();
    if (t === "Jobs") loadJobs(jobStatus);
    if (t === "Konten") loadAccounts();
  }

  function handleJobStatusChange(s) {
    setJobStatus(s);
    setJobs(null);
    loadJobs(s);
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Admin</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Admin Dashboard</h1>
          </div>
          <button type="button" className="btn-secondary" onClick={loadStats}>
            Aktualisieren
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
        )}
      </section>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTabChange(t)}
            className={[
              "px-4 py-2 text-sm font-medium transition",
              tab === t
                ? "border-b-2 border-blue-600 text-blue-700"
                : "text-slate-500 hover:text-slate-800",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Übersicht */}
      {tab === "Übersicht" && (
        <section className="card">
          {loading && !stats && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          )}
          {stats && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Nutzer gesamt" value={stats.total_users} />
              <StatCard label="Aktive Abos" value={stats.active_subscriptions} />
              <StatCard label="Konten gesamt" value={stats.total_accounts} sub={`Aktiv: ${stats.active_accounts}`} />
              <StatCard label="Jobs (24h)" value={stats.jobs_last_24h} sub={`Fehlgeschlagen: ${stats.jobs_failed_last_24h}`} />
              <StatCard label="Jobs ausstehend" value={stats.jobs_pending} sub="Pending / Running / Retrying" />
            </div>
          )}
        </section>
      )}

      {/* Nutzer */}
      {tab === "Nutzer" && (
        <section className="card overflow-x-auto">
          {loading && !users && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          )}
          {users && (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="pb-2 pr-4">ID</th>
                  <th className="pb-2 pr-4">E-Mail</th>
                  <th className="pb-2 pr-4">Plan</th>
                  <th className="pb-2 pr-4">Abo-Status</th>
                  <th className="pb-2 pr-4">Konten</th>
                  <th className="pb-2 pr-4">Admin</th>
                  <th className="pb-2 pr-4">Registriert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="text-slate-700">
                    <td className="py-2 pr-4 font-mono text-xs">{u.id}</td>
                    <td className="py-2 pr-4">{u.email}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge value={u.plan} />
                    </td>
                    <td className="py-2 pr-4">
                      {u.subscription_status ? <StatusBadge value={u.subscription_status} /> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 pr-4">{u.account_count}</td>
                    <td className="py-2 pr-4">{u.is_admin ? "✓" : ""}</td>
                    <td className="py-2 pr-4 text-xs text-slate-400">{fmtDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Jobs */}
      {tab === "Jobs" && (
        <section className="card overflow-x-auto">
          <div className="mb-4 flex flex-wrap gap-2">
            {["", "pending", "running", "completed", "failed", "retrying"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleJobStatusChange(s)}
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  jobStatus === s
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                ].join(" ")}
              >
                {s || "Alle"}
              </button>
            ))}
          </div>
          {loading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          )}
          {jobs && !loading && (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="pb-2 pr-4">ID</th>
                  <th className="pb-2 pr-4">Konto</th>
                  <th className="pb-2 pr-4">Typ</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Versuche</th>
                  <th className="pb-2 pr-4">Erstellt</th>
                  <th className="pb-2 pr-4">Fehler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((j) => (
                  <tr key={j.id} className="text-slate-700">
                    <td className="py-2 pr-4 font-mono text-xs">{j.id}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{j.account_id ?? "—"}</td>
                    <td className="py-2 pr-4 text-xs">{j.type}</td>
                    <td className="py-2 pr-4"><StatusBadge value={j.status} /></td>
                    <td className="py-2 pr-4">{j.attempts}</td>
                    <td className="py-2 pr-4 text-xs text-slate-400">{fmtDate(j.created_at)}</td>
                    <td className="py-2 pr-4 max-w-xs truncate text-xs text-red-600" title={j.error_message || ""}>
                      {j.error_message || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Konten */}
      {tab === "Konten" && (
        <section className="card overflow-x-auto">
          {loading && !accounts && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />)}
            </div>
          )}
          {accounts && (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase text-slate-500">
                  <th className="pb-2 pr-4">ID</th>
                  <th className="pb-2 pr-4">Nutzer-ID</th>
                  <th className="pb-2 pr-4">Label</th>
                  <th className="pb-2 pr-4">Benutzername</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Letzter Scrape</th>
                  <th className="pb-2 pr-4">Fehler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((a) => (
                  <tr key={a.id} className="text-slate-700">
                    <td className="py-2 pr-4 font-mono text-xs">{a.id}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{a.user_id}</td>
                    <td className="py-2 pr-4">{a.label}</td>
                    <td className="py-2 pr-4 text-xs">{a.kleinanzeigen_user_name || "—"}</td>
                    <td className="py-2 pr-4"><StatusBadge value={a.status} /></td>
                    <td className="py-2 pr-4 text-xs text-slate-400">{fmtDate(a.last_scraped_at)}</td>
                    <td className="py-2 pr-4 max-w-xs truncate text-xs text-red-600" title={a.last_error || ""}>
                      {a.last_error || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
