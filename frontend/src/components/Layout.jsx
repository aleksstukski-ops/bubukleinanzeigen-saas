import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "🏠", disabled: false },
  { to: "/listings", label: "Inserate", icon: "📋", disabled: false },
  { to: "/messages", label: "Nachrichten", icon: "💬", disabled: false },
  { to: "/accounts", label: "Konten", icon: "⚙️", disabled: false },
  { to: "/billing", label: "Abrechnung", icon: "💳", disabled: false },
];

const adminNavItem = { to: "/admin", label: "Admin", icon: "🛡️", disabled: false };

function NavItem({ item, mobile = false }) {
  if (item.disabled) {
    return (
      <div
        className={[
          "flex items-center gap-3 rounded-lg px-3 py-2 text-slate-400",
          mobile ? "min-w-0 flex-1 flex-col gap-1 px-2 py-2 text-xs" : "",
        ].join(" ")}
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
          "transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          mobile
            ? `flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs ${isActive ? "text-blue-600" : "text-slate-500"}`
            : `flex items-center gap-3 rounded-lg px-3 py-2 ${isActive ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100"}`,
        ].join(" ")
      }
    >
      <span className={mobile ? "text-lg" : "text-xl"}>{item.icon}</span>
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout, sessionExpired, dismissSessionExpired } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-50">
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
      <aside className={[
        "hidden w-60 flex-shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col",
        sessionExpired ? "pt-12" : "",
      ].join(" ")}>
        <div className="border-b border-slate-200 px-4 py-5">
          <div className="text-lg font-semibold text-slate-900">BubuKleinanzeigen</div>
          <div className="text-xs text-slate-500">SaaS Control Panel</div>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
          {user?.is_admin && <NavItem item={adminNavItem} />}
        </nav>
      </aside>

      <div className={["flex min-w-0 flex-1 flex-col", sessionExpired ? "pt-12" : ""].join(" ")}>
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 md:px-6">
            <div className="min-w-0">
              <div className="text-base font-semibold text-slate-900 md:hidden">BubuKleinanzeigen</div>
              <div className="truncate text-sm text-slate-500">{user?.email || "-"}</div>
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
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-screen-sm items-center justify-around gap-1 px-2 py-2">
          {navItems.map((item) => (
            <NavItem key={item.to} item={item} mobile />
          ))}
          {user?.is_admin && <NavItem item={adminNavItem} mobile />}
        </div>
      </nav>
    </div>
  );
}
