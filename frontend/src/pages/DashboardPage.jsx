import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import Modal from "../components/Modal";
import { usePushNotifications } from "../hooks/usePushNotifications";
import OnboardingWizard, { needsOnboarding } from "../components/OnboardingWizard";
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

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

// Visual + label map per activity action. Falls back to a neutral
// dot/grey for kinds the backend may add later.
const ACTIVITY_META = {
  login:          { icon: "🔐", color: "rgb(37 99 235)",  label: "Login" },
  session_renew:  { icon: "🔄", color: "rgb(37 99 235)",  label: "Session erneuert" },
  bump:           { icon: "⏱️", color: "rgb(16 185 129)", label: "Bump" },
  delete:         { icon: "🗑️", color: "rgb(220 38 38)",  label: "Geloescht" },
  update:         { icon: "📝", color: "rgb(124 58 237)", label: "Aktualisiert" },
  create:         { icon: "➕", color: "rgb(16 185 129)", label: "Erstellt" },
  new_message:    { icon: "💬", color: "rgb(37 99 235)",  label: "Neue Nachricht" },
  reply_sent:     { icon: "↗️", color: "rgb(37 99 235)",  label: "Antwort gesendet" },
  watch_hit:      { icon: "🔔", color: "rgb(225 29 72)",  label: "Treffer" },
  payment_failed: { icon: "💳", color: "rgb(220 38 38)",  label: "Zahlung fehlgeschlagen" },
};

function activityMeta(action) {
  return ACTIVITY_META[action] || { icon: "•", color: "rgb(100 116 139)", label: String(action || "Aktion") };
}

function formatRelative(value) {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "—";
  const diff = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diff < 60) return `vor ${diff}s`;
  if (diff < 3600) return `vor ${Math.round(diff / 60)} Min`;
  if (diff < 86400) return `vor ${Math.round(diff / 3600)} Std`;
  return `vor ${Math.round(diff / 86400)} Tagen`;
}

export default function DashboardPage() {
  const { user, refreshUser } = useAuth();
  const push = usePushNotifications();
  const [accounts, setAccounts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [pageError, setPageError] = useState("");
  const [totalViews, setTotalViews] = useState(null);
  const [totalUnread, setTotalUnread] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [topListingsChart, setTopListingsChart] = useState([]);
  const [viewsByAccount, setViewsByAccount] = useState([]);
  const [activity, setActivity] = useState(null);
  const [activityError, setActivityError] = useState("");

  const loadAccounts = async () => {
    setLoadingAccounts(true);
    setPageError("");
    try {
      const [accountsRes, listingsRes, convsRes] = await Promise.all([
        api.get("/ka-accounts"),
        api.get("/listings/all").catch(() => ({ data: [] })),
        api.get("/messages/conversations").catch(() => ({ data: [] })),
      ]);
      setAccounts(accountsRes.data);
      const allListings = listingsRes.data || [];
      setTotalViews(allListings.reduce((sum, l) => sum + Number(l.view_count || 0), 0));
      const allConvs = convsRes.data || [];
      setTotalUnread(allConvs.reduce((sum, c) => sum + Number(c.unread_count || 0), 0));

      // Build top-5 listings bar chart data
      const top5 = [...allListings]
        .sort((a, b) => Number(b.view_count || 0) - Number(a.view_count || 0))
        .slice(0, 5)
        .map((l) => ({
          name: (l.title || "").length > 18 ? (l.title || "").slice(0, 18) + "..." : (l.title || ""),
          views: Number(l.view_count || 0),
          bookmarks: Number(l.bookmark_count || 0),
        }));
      setTopListingsChart(top5);

      // Build views-per-account area chart data
      const accMap = new Map((accountsRes.data || []).map((a) => [a.id, a.label || "Konto " + a.id]));
      const byAcc = {};
      for (const l of allListings) {
        const key = accMap.get(l.account_id) || "Konto " + l.account_id;
        if (!byAcc[key]) byAcc[key] = { name: key, views: 0, listings: 0 };
        byAcc[key].views += Number(l.view_count || 0);
        byAcc[key].listings += 1;
      }
      setViewsByAccount(Object.values(byAcc));

      await refreshUser();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadActivity = async () => {
    setActivityError("");
    try {
      const res = await api.get("/activity");
      setActivity(Array.isArray(res.data) ? res.data.slice(0, 15) : []);
    } catch (error) {
      // Endpoint may not exist yet — surface a soft message, keep dashboard usable.
      setActivity([]);
      setActivityError(getErrorMessage(error));
    }
  };

  if (!loaded) {
    setLoaded(true);
    if (needsOnboarding()) setShowOnboarding(true);
    loadAccounts();
    loadActivity();
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
              {push.isSupported && push.status !== "denied" && (
                push.status === "granted"
                  ? <button type="button" className="btn-secondary" onClick={push.unsubscribe} disabled={push.loading}>
                      {'🔕'} {push.loading ? "..." : "Push aus"}
                    </button>
                  : <button type="button" className="btn-secondary" onClick={push.subscribe} disabled={push.loading}>
                      {'🔔'} {push.loading ? "..." : "Push an"}
                    </button>
              )}
              <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
                {"⚙️"} Konto hinzufügen
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Verbundene Konten</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{loadingAccounts ? "..." : accounts.length}</div>
              <div className="mt-2 text-sm text-slate-600">Aktiv: {activeAccounts}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Listings gesamt</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{loadingAccounts ? "..." : totalListings}</div>
              <div className="mt-2 text-sm text-slate-600">Aktiv in allen Konten</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Views gesamt</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{loadingAccounts || totalViews === null ? "..." : new Intl.NumberFormat("de-DE").format(totalViews)}</div>
              <div className="mt-2 text-sm text-slate-600">Alle aktiven Inserate</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Ungelesene Nachrichten</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{loadingAccounts || totalUnread === null ? "..." : totalUnread}</div>
              <div className="mt-2 text-sm text-slate-600">Alle Konten</div>
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

        {topListingsChart.length > 0 && (
          <section className="card">
            <h2 className="text-lg font-semibold text-slate-900">{'📊'} Top Inserate nach Views</h2>
            <div className="mt-4" style={{ width: "100%", height: Math.max(180, topListingsChart.length * 36) }}>
              <ResponsiveContainer>
                <BarChart data={topListingsChart} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
                    formatter={(value, name) => [Number(value).toLocaleString("de-DE"), name === "views" ? "Views" : "Gemerkt"]}
                  />
                  <Bar dataKey="views" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="bookmarks" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {viewsByAccount.length > 1 && (
          <section className="card">
            <h2 className="text-lg font-semibold text-slate-900">{'👁️'} Views pro Konto</h2>
            <div className="mt-4" style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <AreaChart data={viewsByAccount} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
                    formatter={(value, name) => [Number(value).toLocaleString("de-DE"), name === "views" ? "Views" : "Inserate"]}
                  />
                  <Area type="monotone" dataKey="views" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="listings" stroke="#10b981" fill="#10b981" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        <section className="card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{"🕒"} Letzte Aktivitaeten</h2>
              <p className="mt-1 text-sm text-slate-500">Login, Bumps, Updates und neue Nachrichten — chronologisch.</p>
            </div>
            <button
              type="button"
              onClick={loadActivity}
              disabled={activity === null}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Aktualisieren
            </button>
          </div>

          {activityError && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {"ℹ️"} {activityError}
            </div>
          )}

          {activity === null && (
            <div className="mt-4 space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          )}

          {activity !== null && activity.length === 0 && !activityError && (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
              Noch keine Aktivitaeten — sie erscheinen hier, sobald du oder der Scraper etwas tun.
            </div>
          )}

          {activity !== null && activity.length > 0 && (
            <ol className="relative mt-4 space-y-3 border-l-2 border-slate-200 pl-5">
              {activity.map((entry, index) => {
                const meta = activityMeta(entry.action || entry.kind);
                const ts = entry.created_at || entry.timestamp || entry.at;
                return (
                  <li key={entry.id ?? `${ts}-${index}`} className="relative">
                    <span
                      className="absolute -left-[1.625rem] flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm shadow ring-2"
                      style={{ color: meta.color, boxShadow: `0 0 0 2px ${meta.color}` }}
                      aria-hidden="true"
                    >
                      {meta.icon}
                    </span>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {entry.title || meta.label}
                      </span>
                      <span className="text-xs text-slate-500">{formatRelative(ts)}</span>
                    </div>
                    {entry.description && (
                      <p className="mt-0.5 text-sm text-slate-600">{entry.description}</p>
                    )}
                    {(entry.account_label || entry.account_id || entry.listing_title) && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {entry.account_label || (entry.account_id ? `Konto ${entry.account_id}` : "")}
                        {entry.listing_title ? ` · ${entry.listing_title}` : ""}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
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

      {showOnboarding && (
        <OnboardingWizard onDone={() => { setShowOnboarding(false); loadAccounts(); }} />
      )}

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
