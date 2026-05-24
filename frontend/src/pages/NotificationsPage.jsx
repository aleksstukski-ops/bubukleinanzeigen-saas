import { useMemo, useState } from "react";
import api from "../lib/api";

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || "Fehler beim Laden.";
}

// Visual mapping per notification kind. Falls back to a neutral
// surface for kinds the backend may add later.
const KIND_META = {
  new_message: { icon: "💬", color: "rgb(37 99 235)", label: "Nachricht" },
  session_expired: { icon: "🔐", color: "rgb(245 158 11)", label: "Session" },
  bump_executed: { icon: "⏱️", color: "rgb(16 185 129)", label: "Bump" },
  listing_updated: { icon: "📝", color: "rgb(124 58 237)", label: "Inserat" },
  watch_hit: { icon: "🔔", color: "rgb(225 29 72)", label: "Treffer" },
  payment_failed: { icon: "💳", color: "rgb(220 38 38)", label: "Zahlung" },
};

function metaFor(kind) {
  return KIND_META[kind] || { icon: "🔔", color: "var(--accent)", label: "Hinweis" };
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch (_) {
    return value;
  }
}

function formatRelative(value) {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return "—";
  const diff = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diff < 60) return `vor ${diff}s`;
  if (diff < 3600) return `vor ${Math.round(diff / 60)}m`;
  if (diff < 86400) return `vor ${Math.round(diff / 3600)}h`;
  return `vor ${Math.round(diff / 86400)}d`;
}

const FILTERS = [
  { id: "all", label: "Alle" },
  { id: "unread", label: "Ungelesen" },
  { id: "read", label: "Gelesen" },
];

export default function NotificationsPage() {
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [rowBusyId, setRowBusyId] = useState("");

  const load = async () => {
    setLoading(true);
    setPageError("");
    try {
      const response = await api.get("/notifications");
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (!loaded) {
    setLoaded(true);
    load();
  }

  const filtered = useMemo(() => {
    if (filter === "unread") return items.filter((n) => !n.is_read);
    if (filter === "read") return items.filter((n) => n.is_read);
    return items;
  }, [items, filter]);

  const unreadCount = useMemo(() => items.filter((n) => !n.is_read).length, [items]);

  const handleMarkOne = async (notification) => {
    if (notification.is_read) return;
    setRowBusyId(String(notification.id));
    setPageError("");
    try {
      await api.patch(`/notifications/${notification.id}/read`);
      setItems((prev) => prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)));
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setRowBusyId("");
    }
  };

  const handleMarkAll = async () => {
    if (unreadCount === 0) return;
    setBulkBusy(true);
    setPageError("");
    setPageNotice("");
    try {
      // Prefer a bulk endpoint when the backend supports it; fall back
      // to per-item PATCH so the UI is correct even without it.
      try {
        await api.post("/notifications/mark-all-read");
      } catch (_) {
        const unread = items.filter((n) => !n.is_read);
        for (const n of unread) {
          // eslint-disable-next-line no-await-in-loop
          await api.patch(`/notifications/${n.id}/read`);
        }
      }
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setPageNotice("Alle Benachrichtigungen als gelesen markiert.");
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>{"🔔"} Benachrichtigungen</p>
            <h1 className="mt-1 text-2xl font-semibold" style={{ color: "var(--text)" }}>Mitteilungs-Center</h1>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Neue Nachrichten, abgelaufene Sessions, ausgefuehrte Bumps — alles an einem Ort.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-black/5 active:scale-[0.98] disabled:opacity-60 dark:hover:bg-white/5"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            >
              {loading ? "Laedt..." : "Aktualisieren"}
            </button>
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={bulkBusy || unreadCount === 0}
              className="btn-primary"
            >
              {bulkBusy ? "Markiert..." : `Alle als gelesen (${unreadCount})`}
            </button>
          </div>
        </div>

        {pageError && (
          <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
            {pageError}
          </div>
        )}
        {pageNotice && (
          <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            {pageNotice}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className="rounded-full px-3 py-1 text-xs font-medium transition"
              style={
                filter === f.id
                  ? { background: "var(--accent)", color: "#fff" }
                  : { background: "var(--bg)", color: "var(--text-muted)", border: "1px solid var(--border)" }
              }
            >
              {f.label}
              {f.id === "unread" && unreadCount > 0 && (
                <span className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        {loading && items.length === 0 && (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg" style={{ background: "var(--bg)" }} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div
            className="rounded-lg border border-dashed p-5 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            {filter === "unread"
              ? "Keine ungelesenen Benachrichtigungen."
              : filter === "read"
                ? "Noch keine gelesenen Benachrichtigungen."
                : "Du hast noch keine Benachrichtigungen. Wir melden uns, sobald etwas passiert."}
          </div>
        )}

        {filtered.length > 0 && (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {filtered.map((n) => {
              const meta = metaFor(n.kind);
              const isBusy = rowBusyId === String(n.id);
              return (
                <li
                  key={n.id}
                  className="flex items-start gap-3 py-3 transition"
                  style={{
                    background: n.is_read ? "transparent" : "var(--accent-bg)",
                    paddingLeft: n.is_read ? 0 : "0.75rem",
                    paddingRight: n.is_read ? 0 : "0.75rem",
                    borderRadius: n.is_read ? 0 : "0.5rem",
                  }}
                >
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
                    style={{ background: "var(--surface)", color: meta.color, border: "1px solid var(--border)" }}
                  >
                    {meta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                        {n.title || meta.label}
                      </span>
                      {!n.is_read && (
                        <span className="inline-flex h-2 w-2 rounded-full bg-red-500" aria-label="Ungelesen" />
                      )}
                      <span className="text-xs" style={{ color: "var(--text-subtle)" }}>
                        {formatRelative(n.created_at)}
                      </span>
                    </div>
                    {n.body && (
                      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                        {n.body}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs" style={{ color: "var(--text-subtle)" }}>
                      <span>{formatDate(n.created_at)}</span>
                      {n.url && (
                        <a
                          href={n.url}
                          className="font-medium hover:underline"
                          style={{ color: "var(--accent)" }}
                        >
                          Oeffnen →
                        </a>
                      )}
                      {!n.is_read && (
                        <button
                          type="button"
                          onClick={() => handleMarkOne(n)}
                          disabled={isBusy}
                          className="font-medium hover:underline disabled:opacity-60"
                          style={{ color: "var(--accent)" }}
                        >
                          {isBusy ? "..." : "Als gelesen markieren"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
