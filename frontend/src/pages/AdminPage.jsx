import { useState } from "react";
import api from "../lib/api";

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || "Fehler beim Laden.";
}

const PLAN_PRICE_EUR = { free: 0, starter: 9, pro: 19, business: 39 };

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

function fmtRelative(iso) {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return `vor ${diffSec}s`;
  if (diffSec < 3600) return `vor ${Math.round(diffSec / 60)}m`;
  if (diffSec < 86400) return `vor ${Math.round(diffSec / 3600)}h`;
  return `vor ${Math.round(diffSec / 86400)}d`;
}

function fmtEur(value) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function HeroCard({ icon, label, value, sub, accent = "var(--accent)" }) {
  return (
    <div
      className="flex flex-col rounded-2xl border p-5"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-subtle)" }}>
          {label}
        </span>
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
          style={{ background: "var(--accent-bg)", color: accent }}
        >
          {icon}
        </span>
      </div>
      <div className="mt-3 text-3xl font-bold" style={{ color: "var(--text)" }}>
        {value ?? "…"}
      </div>
      {sub && (
        <div className="mt-1 text-xs" style={{ color: "var(--text-subtle)" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function HealthRow({ label, state, hint }) {
  // state: "ok" | "warn" | "down" | "unknown"
  const palette = {
    ok: { dot: "rgb(16 185 129)", text: "OK" },
    warn: { dot: "rgb(245 158 11)", text: "Warnung" },
    down: { dot: "rgb(220 38 38)", text: "Fehler" },
    unknown: { dot: "var(--text-subtle)", text: "Pruefen…" },
  };
  const p = palette[state] || palette.unknown;
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</div>
        {hint && <div className="text-xs" style={{ color: "var(--text-subtle)" }}>{hint}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs font-semibold" style={{ color: p.dot }}>
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.dot }} />
        {p.text}
      </div>
    </div>
  );
}

function StatusBadge({ value }) {
  const colors = {
    active: { bg: "rgba(16,185,129,0.15)", fg: "rgb(5 150 105)" },
    pending: { bg: "rgba(245,158,11,0.15)", fg: "rgb(180 83 9)" },
    pending_login: { bg: "rgba(245,158,11,0.15)", fg: "rgb(180 83 9)" },
    failed: { bg: "rgba(220,38,38,0.15)", fg: "rgb(185 28 28)" },
    session_expired: { bg: "rgba(220,38,38,0.15)", fg: "rgb(185 28 28)" },
    banned: { bg: "rgba(220,38,38,0.15)", fg: "rgb(185 28 28)" },
    running: { bg: "rgba(37,99,235,0.15)", fg: "rgb(29 78 216)" },
    retrying: { bg: "rgba(234,88,12,0.15)", fg: "rgb(194 65 12)" },
    completed: { bg: "rgba(100,116,139,0.15)", fg: "rgb(71 85 105)" },
    success: { bg: "rgba(16,185,129,0.15)", fg: "rgb(5 150 105)" },
    disabled: { bg: "rgba(100,116,139,0.20)", fg: "rgb(51 65 85)" },
  };
  const c = colors[value] || { bg: "rgba(100,116,139,0.15)", fg: "rgb(71 85 105)" };
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: c.bg, color: c.fg }}
    >
      {value}
    </span>
  );
}

const TABS = ["Uebersicht", "Nutzer", "Jobs", "Konten"];

export default function AdminPage() {
  const [tab, setTab] = useState("Uebersicht");
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [recentJobs, setRecentJobs] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [jobStatus, setJobStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [inited, setInited] = useState(false);
  const [health, setHealth] = useState({
    api: "unknown", database: "unknown", redis: "unknown", scraper: "unknown",
  });

  if (!inited) {
    setInited(true);
    loadOverview();
  }

  async function loadOverview() {
    setLoading(true);
    setError("");
    const next = { api: "unknown", database: "unknown", redis: "unknown", scraper: "unknown" };
    try {
      const statsRes = await api.get("/admin/stats");
      setStats(statsRes.data);
      next.api = "ok";
      next.database = "ok";
    } catch (err) {
      next.api = "down";
      next.database = "down";
      setError(getErrorMessage(err));
    }
    // Users (powers MRR estimate)
    try {
      const usersRes = await api.get("/admin/users");
      setUsers(usersRes.data);
    } catch (_) {
      // already surfaced via stats error
    }
    // Recent jobs (powers Activities + Redis health hint)
    try {
      const jobsRes = await api.get("/admin/jobs", { params: { limit: 12 } });
      const data = Array.isArray(jobsRes.data) ? jobsRes.data : [];
      setRecentJobs(data.slice(0, 12));
      next.redis = "ok";
      // Scraper health = any non-failed job seen in last 24 h
      const running = data.some((j) => j.status === "running" || j.status === "completed" || j.status === "success");
      const allFailed = data.length > 0 && data.every((j) => j.status === "failed");
      next.scraper = allFailed ? "warn" : running ? "ok" : "unknown";
    } catch (_) {
      next.redis = "down";
      next.scraper = "unknown";
    }
    setHealth(next);
    setLoading(false);
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

  // Derived: MRR estimate from current paid subscribers
  let mrr = null;
  let paidCount = null;
  if (users) {
    let total = 0;
    let paid = 0;
    for (const u of users) {
      if (u?.subscription_status === "active" && PLAN_PRICE_EUR[u.plan] > 0) {
        total += PLAN_PRICE_EUR[u.plan];
        paid += 1;
      }
    }
    mrr = total;
    paidCount = paid;
  }

  return (
    <div className="space-y-5">
      <section
        className="rounded-2xl border p-5"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>{"🛡️"} Admin</p>
            <h1 className="mt-1 text-2xl font-bold" style={{ color: "var(--text)" }}>Admin Dashboard</h1>
            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              Uebersicht ueber Nutzer, Umsatz, Sessions und System-Gesundheit.
            </p>
          </div>
          <button
            type="button"
            onClick={loadOverview}
            disabled={loading}
            className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-black/5 active:scale-[0.98] disabled:opacity-60 dark:hover:bg-white/5"
            style={{ borderColor: "var(--border)", color: "var(--text)" }}
          >
            {loading ? "Aktualisiert…" : "Aktualisieren"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
            {error}
          </div>
        )}
      </section>

      <div className="flex gap-1 overflow-x-auto border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTabChange(t)}
            className={[
              "shrink-0 px-4 py-2 text-sm font-medium transition",
              tab === t ? "border-b-2" : "hover:opacity-100",
            ].join(" ")}
            style={{
              borderColor: tab === t ? "var(--accent)" : "transparent",
              color: tab === t ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Uebersicht" && (
        <>
          {/* Hero stats: 4 KPIs */}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HeroCard
              icon={"👤"}
              label="Nutzer"
              value={stats?.total_users ?? "…"}
              sub={paidCount != null ? `${paidCount} zahlend` : "Aktive Abos werden geladen"}
            />
            <HeroCard
              icon={"💶"}
              label="MRR (Schaetzung)"
              value={mrr != null ? fmtEur(mrr) : "…"}
              sub={paidCount != null ? `Basis: ${paidCount} aktive Abos` : "Berechnet aus aktiven Plaenen"}
            />
            <HeroCard
              icon={"🔐"}
              label="Aktive Sessions"
              value={stats?.active_accounts ?? "…"}
              sub={stats ? `von ${stats.total_accounts} Konten` : "Kleinanzeigen-Logins"}
            />
            <HeroCard
              icon={"⚙️"}
              label="Jobs (24h)"
              value={stats?.jobs_last_24h ?? "…"}
              sub={stats ? `${stats.jobs_failed_last_24h} fehlgeschlagen · ${stats.jobs_pending} offen` : "Pending / Running / Retrying"}
            />
          </section>

          {/* Health + Activities side-by-side on lg, stacked on mobile */}
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <div
              className="rounded-2xl border p-5"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>System-Health</h2>
                <span className="text-xs" style={{ color: "var(--text-subtle)" }}>Live</span>
              </div>
              <div className="mt-2 divide-y" style={{ borderColor: "var(--border)" }}>
                <HealthRow label="API (FastAPI)" state={health.api} hint="/api/admin/stats" />
                <HealthRow label="Datenbank (Postgres)" state={health.database} hint="Stats-Query erfolgreich" />
                <HealthRow label="Redis Queue" state={health.redis} hint="Job-Liste erreichbar" />
                <HealthRow label="Scraper Worker" state={health.scraper} hint="Job-Aktivitaet 24h" />
              </div>
              <p className="mt-3 text-xs" style={{ color: "var(--text-subtle)" }}>
                Indirekt aus API-Reaktion abgeleitet — Docker-PS pruefen wenn dauerhaft rot.
              </p>
            </div>

            <div
              className="rounded-2xl border p-5"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold" style={{ color: "var(--text)" }}>Letzte Aktivitaeten</h2>
                <button
                  type="button"
                  onClick={() => handleTabChange("Jobs")}
                  className="text-xs font-medium hover:underline"
                  style={{ color: "var(--accent)" }}
                >
                  Alle Jobs →
                </button>
              </div>
              {!recentJobs && (
                <div className="mt-3 space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-lg" style={{ background: "var(--bg)" }} />
                  ))}
                </div>
              )}
              {recentJobs && recentJobs.length === 0 && (
                <p className="mt-3 text-sm" style={{ color: "var(--text-subtle)" }}>Keine Aktivitaeten in den letzten 24h.</p>
              )}
              {recentJobs && recentJobs.length > 0 && (
                <ul className="mt-3 divide-y" style={{ borderColor: "var(--border)" }}>
                  {recentJobs.map((j) => (
                    <li key={j.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium" style={{ color: "var(--text)" }}>
                          {j.type}
                          {j.account_id ? <span className="ml-1 text-xs font-normal" style={{ color: "var(--text-subtle)" }}>#{j.account_id}</span> : null}
                        </div>
                        <div className="text-xs" style={{ color: "var(--text-subtle)" }}>
                          {fmtRelative(j.finished_at || j.started_at || j.created_at)}
                          {j.error_message ? ` · ${j.error_message}` : ""}
                        </div>
                      </div>
                      <StatusBadge value={j.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}

      {tab === "Nutzer" && (
        <section
          className="overflow-x-auto rounded-2xl border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {loading && !users && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg" style={{ background: "var(--bg)" }} />)}
            </div>
          )}
          {users && (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase" style={{ color: "var(--text-subtle)" }}>
                  <th className="pb-2 pr-4">ID</th>
                  <th className="pb-2 pr-4">E-Mail</th>
                  <th className="pb-2 pr-4">Plan</th>
                  <th className="pb-2 pr-4">Abo-Status</th>
                  <th className="pb-2 pr-4">Konten</th>
                  <th className="pb-2 pr-4">Admin</th>
                  <th className="pb-2 pr-4">Registriert</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                    <td className="py-2 pr-4 font-mono text-xs">{u.id}</td>
                    <td className="py-2 pr-4">{u.email}</td>
                    <td className="py-2 pr-4"><StatusBadge value={u.plan} /></td>
                    <td className="py-2 pr-4">
                      {u.subscription_status
                        ? <StatusBadge value={u.subscription_status} />
                        : <span style={{ color: "var(--text-subtle)" }}>—</span>}
                    </td>
                    <td className="py-2 pr-4">{u.account_count}</td>
                    <td className="py-2 pr-4">{u.is_admin ? "✓" : ""}</td>
                    <td className="py-2 pr-4 text-xs" style={{ color: "var(--text-subtle)" }}>{fmtDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === "Jobs" && (
        <section
          className="overflow-x-auto rounded-2xl border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="mb-4 flex flex-wrap gap-2">
            {["", "pending", "running", "completed", "failed", "retrying"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleJobStatusChange(s)}
                className="rounded-full px-3 py-1 text-xs font-medium transition"
                style={
                  jobStatus === s
                    ? { background: "var(--accent)", color: "#fff" }
                    : { background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }
                }
              >
                {s || "Alle"}
              </button>
            ))}
          </div>
          {loading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg" style={{ background: "var(--bg)" }} />)}
            </div>
          )}
          {jobs && !loading && (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase" style={{ color: "var(--text-subtle)" }}>
                  <th className="pb-2 pr-4">ID</th>
                  <th className="pb-2 pr-4">Konto</th>
                  <th className="pb-2 pr-4">Typ</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Versuche</th>
                  <th className="pb-2 pr-4">Erstellt</th>
                  <th className="pb-2 pr-4">Fehler</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-t" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                    <td className="py-2 pr-4 font-mono text-xs">{j.id}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{j.account_id ?? "—"}</td>
                    <td className="py-2 pr-4 text-xs">{j.type}</td>
                    <td className="py-2 pr-4"><StatusBadge value={j.status} /></td>
                    <td className="py-2 pr-4">{j.attempts}</td>
                    <td className="py-2 pr-4 text-xs" style={{ color: "var(--text-subtle)" }}>{fmtDate(j.created_at)}</td>
                    <td className="py-2 pr-4 max-w-xs truncate text-xs text-red-600 dark:text-red-400" title={j.error_message || ""}>
                      {j.error_message || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {tab === "Konten" && (
        <section
          className="overflow-x-auto rounded-2xl border p-5"
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {loading && !accounts && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg" style={{ background: "var(--bg)" }} />)}
            </div>
          )}
          {accounts && (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase" style={{ color: "var(--text-subtle)" }}>
                  <th className="pb-2 pr-4">ID</th>
                  <th className="pb-2 pr-4">Nutzer-ID</th>
                  <th className="pb-2 pr-4">Label</th>
                  <th className="pb-2 pr-4">Benutzername</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Letzter Scrape</th>
                  <th className="pb-2 pr-4">Fehler</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-t" style={{ borderColor: "var(--border)", color: "var(--text)" }}>
                    <td className="py-2 pr-4 font-mono text-xs">{a.id}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{a.user_id}</td>
                    <td className="py-2 pr-4">{a.label}</td>
                    <td className="py-2 pr-4 text-xs">{a.kleinanzeigen_user_name || "—"}</td>
                    <td className="py-2 pr-4"><StatusBadge value={a.status} /></td>
                    <td className="py-2 pr-4 text-xs" style={{ color: "var(--text-subtle)" }}>{fmtDate(a.last_scraped_at)}</td>
                    <td className="py-2 pr-4 max-w-xs truncate text-xs text-red-600 dark:text-red-400" title={a.last_error || ""}>
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
