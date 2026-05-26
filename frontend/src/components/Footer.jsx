import { Link } from "react-router-dom";

/**
 * App-wide footer rendered below the main content in Layout. CSS
 * variables make it match both light and dark theme.
 */

const LINKS = [
  { to: "/impressum",   label: "Impressum" },
  { to: "/datenschutz", label: "Datenschutz" },
  { to: "/agb",         label: "AGB" },
  { to: "/support",     label: "Support" },
];

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer
      // Extra pb-24 on mobile clears the fixed bottom-nav (~64 px) +
      // safe-area; md:pb-6 falls back to the normal vertical rhythm
      // once the bottom-nav is hidden.
      className="border-t px-4 pt-6 pb-24 md:px-6 md:pb-6"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        color: "var(--text-muted)",
      }}
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 text-sm sm:flex-row">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold text-white"
            style={{ background: "var(--accent)" }}
            aria-hidden="true"
          >
            B
          </span>
          <span style={{ color: "var(--text)" }}>BubuBay</span>
          <span style={{ color: "var(--text-subtle)" }}>
            © {year}
          </span>
        </div>

        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {LINKS.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="transition hover:underline"
                  style={{ color: "var(--text-muted)" }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
