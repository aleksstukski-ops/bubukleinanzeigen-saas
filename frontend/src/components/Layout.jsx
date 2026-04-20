import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

// All nav items shown in desktop sidebar
const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "🏠" },
  { to: "/listings", label: "Inserate", icon: "📋" },
  { to: "/messages", label: "Nachrichten", icon: "💬" },
  { to: "/accounts", label: "Konten", icon: "⚙️" },
  { to: "/billing", label: "Abrechnung", icon: "💳" },
  { to: "/settings", label: "Einstellungen", icon: "🎨" },
];

// Mobile bottom nav shows only the 5 most important items (375px limit)
const mobileNavItems = navItems.slice(0, 5);

const adminNavItem = { to: "/admin", label: "Admin", icon: "🛡️" };

function NavItem({ item, mobile = false }) {
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

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        [
          "transition focus:outline-none",
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
      <span className={mobile ? "text-lg" : "text-xl"}>{item.icon}</span>
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout, sessionExpired, dismissSessionExpired } = useAuth();

  return (
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
      <aside
        className={["hidden w-60 flex-shrink-0 border-r md:flex md:flex-col", sessionExpired ? "pt-12" : ""].join(" ")}
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="border-b px-4 py-5" style={{ borderColor: "var(--border)" }}>
          <div className="text-lg font-semibold" style={{ color: "var(--text)" }}>BubuKleinanzeigen</div>
          <div className="text-xs" style={{ color: "var(--text-subtle)" }}>SaaS Control Panel</div>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
          {user?.is_admin && <NavItem item={adminNavItem} />}
        </nav>
      </aside>

      <div className={["flex min-w-0 flex-1 flex-col", sessionExpired ? "pt-12" : ""].join(" ")}>
        <header
          className="sticky top-0 z-20 border-b backdrop-blur"
          style={{ background: "color-mix(in srgb, var(--surface) 95%, transparent)", borderColor: "var(--border)" }}
        >
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="min-w-0">
              <div className="text-base font-semibold md:hidden" style={{ color: "var(--text)" }}>BubuKleinanzeigen</div>
              <div className="truncate text-sm" style={{ color: "var(--text-muted)" }}>{user?.email || "-"}</div>
            </div>
            <button type="button" onClick={logout} className="btn-secondary shrink-0">
              Abmelden
            </button>
          </div>
        </header>

        <main className="page-shell min-w-0 flex-1 px-4 py-4 md:px-6 md:py-6">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t md:hidden"
        style={{ background: "var(--surface)", borderColor: "var(--border)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-screen-sm items-center justify-around gap-1 px-2 py-2">
          {mobileNavItems.map((item) => (
            <NavItem key={item.to} item={item} mobile />
          ))}
        </div>
      </nav>
    </div>
  );
}
