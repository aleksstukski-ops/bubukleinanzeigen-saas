import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "🏠", disabled: false },
  { to: "/listings", label: "Inserate", icon: "📋", disabled: true },
  { to: "/messages", label: "Nachrichten", icon: "💬", disabled: true },
  { to: "/accounts", label: "Konten", icon: "⚙️", disabled: false },
];

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
        <span className="truncate">{item.label}</span>
        {!mobile ? <span className="ml-auto text-xs">Bald</span> : <span className="text-[10px]">Bald</span>}
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
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-screen-2xl">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="text-lg font-semibold text-slate-900">BubuKleinanzeigen</div>
            <div className="mt-1 text-sm text-slate-500">SaaS Control Panel</div>
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            {navItems.map((item) => (<NavItem key={item.label} item={item} />))}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 md:px-6">
              <div className="min-w-0">
                <div className="text-base font-semibold text-slate-900 md:hidden">BubuKleinanzeigen</div>
                <div className="truncate text-sm text-slate-500">{user?.email || "\u2014"}</div>
              </div>
              <button type="button" onClick={logout} className="btn-secondary shrink-0">Abmelden</button>
            </div>
          </header>
          <main className="page-shell min-w-0 flex-1 px-4 py-4 md:px-6 md:py-6"><Outlet /></main>
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="mx-auto flex max-w-screen-sm items-center justify-around gap-1 px-2 py-2">
          {navItems.map((item) => (<NavItem key={item.label} item={item} mobile />))}
        </div>
      </nav>
    </div>
  );
}
