import { useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import api from "../lib/api";
import { ToastProvider } from "./Toast";
import useKeyboardShortcuts from "../hooks/useKeyboardShortcuts";
import Footer from "./Footer";

// All nav items shown in desktop sidebar
const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "🏠" },
  { to: "/listings", label: "Inserate", icon: "📋" },
  { to: "/messages", label: "Nachrichten", icon: "💬", badgeKey: "unread" },
  { to: "/accounts", label: "Konten", icon: "⚙️" },
  { to: "/billing", label: "Abrechnung", icon: "💳" },
  { to: "/settings", label: "Einstellungen", icon: "🎨" },
  { to: "/auto-replies", label: "Auto-Antworten", icon: "⚡" },
  { to: "/watches", label: "Kategorie-Monitor", icon: "🔔" },
  { to: "/ai-create", label: "KI-Erstellen", icon: "🪄" },
  { to: "/auto-bump", label: "Auto-Bump", icon: "⏱️" },
  { to: "/notifications", label: "Mitteilungen", icon: "📨" },
  { to: "/support", label: "Support", icon: "💬" },
];

// Mobile bottom nav shows only the 5 most important items (375px limit).
// Everything past the first five lives in the desktop sidebar only.
const mobileNavItems = navItems.slice(0, 5);

const adminNavItem = { to: "/admin", label: "Admin", icon: "🛡️" };

function NavItem({ item, mobile = false, badgeValue = 0 }) {
  if (item.disabled) {
    return (
      <div
        className={[
          "flex items-center gap-3 rounded-lg px-3 py-2",
          mobile ? "min-w-0 flex-1 flex-col gap-1 px-2 py-2 text-xs" : "",
        ].join(" ")}
        style={{ color: "var(--text-subtle)" }}
        aria-disabled="true"
      >
        <span className={mobile ? "text-lg" : "text-xl"}>{item.icon}</span>
        <span>{item.label}</span>
        <span className={mobile ? "text-[10px] uppercase" : "ml-auto text-xs uppercase"}>Bald</span>
      </div>
    );
  }

  const showBadge = badgeValue > 0;
  const badgeText = badgeValue > 99 ? "99+" : String(badgeValue);

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        [
          "relative transition focus:outline-none",
          mobile
            ? `flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs`
            : `flex items-center gap-3 rounded-lg px-3 py-2`,
        ].join(" ")
      }
      style={({ isActive }) => ({
        background: isActive && !mobile ? "var(--accent-bg)" : "transparent",
        color: isActive ? "var(--accent)" : "var(--text-muted)",
        fontWeight: isActive ? 600 : undefined,
      })}
    >
      <span className={["relative", mobile ? "text-lg" : "text-xl"].join(" ")}>
        {item.icon}
        {showBadge && mobile && (
          <span
            className="absolute -right-2 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white"
            aria-label={`${badgeText} ungelesen`}
          >
            {badgeText}
          </span>
        )}
      </span>
      <span>{item.label}</span>
      {showBadge && !mobile && (
        <span
          className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white"
          aria-label={`${badgeText} ungelesen`}
        >
          {badgeText}
        </span>
      )}
    </NavLink>
  );
}

function QuickSearchPalette({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  // Reset query whenever the palette transitions from closed -> open
  if (!open && query !== "") {
    setQuery("");
  }

  if (!open) return null;

  const targets = navItems
    .concat([
      { to: "/auto-bump", label: "Auto-Bump", icon: "⏱️" },
      { to: "/notifications", label: "Mitteilungen", icon: "📨" },
      { to: "/support", label: "Support", icon: "💬" },
    ])
    .filter((item, i, arr) => arr.findIndex((x) => x.to === item.to) === i);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? targets.filter((t) => t.label.toLowerCase().includes(q) || t.to.toLowerCase().includes(q))
    : targets;

  const pick = (to) => {
    onClose();
    navigate(to);
  };

  const onKeyDown = (event) => {
    if (event.key === "Enter" && filtered.length > 0) {
      event.preventDefault();
      pick(filtered[0].to);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[55] flex items-start justify-center px-4 pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Schnellsuche"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
          <span className="text-lg" aria-hidden="true">{"🔍"}</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            placeholder="Seite suchen oder Befehl tippen..."
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--text)" }}
            aria-label="Suchanfrage"
          />
          <kbd
            className="hidden rounded px-1.5 py-0.5 text-[10px] font-medium sm:inline-block"
            style={{ background: "var(--bg)", color: "var(--text-subtle)", border: "1px solid var(--border)" }}
          >
            Esc
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm" style={{ color: "var(--text-subtle)" }}>
              Keine Treffer.
            </li>
          )}
          {filtered.map((t, i) => (
            <li key={t.to}>
              <button
                type="button"
                onClick={() => pick(t.to)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: "var(--text)" }}
              >
                <span className="text-lg" aria-hidden="true">{t.icon}</span>
                <span className="flex-1 truncate">{t.label}</span>
                {i === 0 && (
                  <kbd
                    className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: "var(--bg)", color: "var(--text-subtle)", border: "1px solid var(--border)" }}
                  >
                    {"⏎"}
                  </kbd>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout, sessionExpired, dismissSessionExpired } = useAuth();
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [pollerStarted, setPollerStarted] = useState(false);
  const [kaNeedsLogin, setKaNeedsLogin] = useState([]);
  const [kaBannerDismissedIds, setKaBannerDismissedIds] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pollerRef = useRef(null);

  const shortcuts = useMemo(() => ([
    {
      key: "k",
      meta: true,
      handler: () => setPaletteOpen((v) => !v),
    },
    {
      key: "k",
      ctrl: true,
      handler: () => setPaletteOpen((v) => !v),
    },
    {
      key: "Escape",
      allowInInput: true,
      // Only consume Esc when the palette is the foreground UI. Other
      // modals (Modal.jsx) bring their own Escape handling, so we just
      // close ours and don't preventDefault if it wasn't open.
      preventDefault: paletteOpen,
      handler: () => {
        if (paletteOpen) setPaletteOpen(false);
      },
    },
  ]), [paletteOpen]);

  useKeyboardShortcuts(shortcuts);

  const fetchUnread = async () => {
    try {
      const response = await api.get("/messages/unread-summary");
      const total = Number(response?.data?.total_unread || 0);
      setUnreadTotal(Number.isFinite(total) ? total : 0);
    } catch (error) {
      // silent — badge is non-critical, retry on next tick
    }
  };

  const fetchKaHealth = async () => {
    try {
      const response = await api.get("/ka-accounts/health-summary");
      const items = response?.data?.needs_login || [];
      setKaNeedsLogin(Array.isArray(items) ? items : []);
    } catch (error) {
      // silent — banner is non-critical
    }
  };

  if (!pollerStarted && user) {
    setPollerStarted(true);
    fetchUnread();
    fetchKaHealth();
    pollerRef.current = window.setInterval(() => {
      if (document.hidden) return;
      fetchUnread();
      fetchKaHealth();
    }, 15000);
  }

  const badges = { unread: unreadTotal };

  // Compute a stable signature of currently-affected accounts so dismiss
  // applies until the SET of affected accounts changes; a fresh expiry
  // re-shows the banner without further polling logic.
  const kaSignature = kaNeedsLogin.map((a) => a.id).sort((a, b) => a - b).join(",");
  const showKaBanner = kaNeedsLogin.length > 0 && kaSignature !== kaBannerDismissedIds;

  return (
    <ToastProvider>
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      {sessionExpired && (
        <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-amber-500 px-4 py-3 text-sm font-medium text-white shadow-md">
          <span>{'⚠️'} Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.</span>
          <button
            type="button"
            onClick={dismissSessionExpired}
            className="shrink-0 rounded-md bg-white/20 px-3 py-1 text-sm font-semibold hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white"
          >
            Neu einloggen
          </button>
        </div>
      )}
      {showKaBanner && !sessionExpired && (
        <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-3 bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-md">
          <span className="min-w-0 truncate">
            {'🔐'}{' '}
            {kaNeedsLogin.length === 1
              ? `Konto "${kaNeedsLogin[0].label}" wird aktualisiert — bitte neu einloggen.`
              : `${kaNeedsLogin.length} Konten brauchen einen Re-Login.`}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <NavLink
              to="/accounts"
              className="rounded-md bg-white/20 px-3 py-1 text-sm font-semibold hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white"
            >
              Zu Konten
            </NavLink>
            <button
              type="button"
              onClick={() => setKaBannerDismissedIds(kaSignature)}
              aria-label="Banner schliessen"
              className="rounded-md bg-white/10 px-2 py-1 text-sm font-semibold hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
            >
              {'×'}
            </button>
          </div>
        </div>
      )}
      <aside
        className={["hidden w-60 flex-shrink-0 border-r md:flex md:flex-col", (sessionExpired || showKaBanner) ? "pt-12" : ""].join(" ")}
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="border-b px-4 py-5" style={{ borderColor: "var(--border)" }}>
          <div className="text-lg font-semibold" style={{ color: "var(--text)" }}>BubuBay</div>
          <div className="text-xs" style={{ color: "var(--text-subtle)" }}>Multi-Platform Verkaufsmanager</div>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => (
            <NavItem key={item.to} item={item} badgeValue={item.badgeKey ? badges[item.badgeKey] || 0 : 0} />
          ))}
          {user?.is_admin && <NavItem item={adminNavItem} />}
        </nav>
      </aside>

      <div className={["flex min-w-0 flex-1 flex-col", (sessionExpired || showKaBanner) ? "pt-12" : ""].join(" ")}>
        <header
          className="sticky top-0 z-20 border-b backdrop-blur"
          style={{ background: "color-mix(in srgb, var(--surface) 95%, transparent)", borderColor: "var(--border)" }}
        >
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="min-w-0">
              <div className="text-base font-semibold md:hidden" style={{ color: "var(--text)" }}>BubuBay</div>
              <div className="truncate text-sm" style={{ color: "var(--text-muted)" }}>{user?.email || "-"}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Schnellsuche oeffnen"
                title="Schnellsuche (Cmd+K)"
                className="hidden items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition hover:bg-black/5 sm:inline-flex dark:hover:bg-white/5"
                style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
              >
                <span aria-hidden="true">{"🔍"}</span>
                <span>Suche</span>
                <kbd
                  className="rounded px-1 py-0.5 text-[10px] font-medium"
                  style={{ background: "var(--bg)", color: "var(--text-subtle)", border: "1px solid var(--border)" }}
                >
                  ⌘K
                </kbd>
              </button>
              <button type="button" onClick={logout} className="btn-secondary shrink-0">
                Abmelden
              </button>
            </div>
          </div>
        </header>

        <main className="page-shell min-w-0 flex-1 px-4 py-4 md:px-6 md:py-6">
          <Outlet />
        </main>
        <Footer />
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t md:hidden"
        style={{ background: "var(--surface)", borderColor: "var(--border)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-screen-sm items-center justify-around gap-1 px-2 py-2">
          {mobileNavItems.map((item) => (
            <NavItem
              key={item.to}
              item={item}
              mobile
              badgeValue={item.badgeKey ? badges[item.badgeKey] || 0 : 0}
            />
          ))}
        </div>
      </nav>
      <QuickSearchPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
    </ToastProvider>
  );
}
