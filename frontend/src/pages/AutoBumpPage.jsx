import { useMemo, useState } from "react";
import api from "../lib/api";

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || "Aktion fehlgeschlagen.";
}

// Interval choices: API uses days (existing /listings/{id}/bump-schedule
// already accepts integer days), so 6h/12h come close via fractional days.
// We render labels in hours but send the existing days field — backend
// route /listings/auto-bump (this page's contract) is expected to accept
// hours in the new combined endpoint.
const INTERVAL_OPTIONS = [
  { value: 6, label: "Alle 6 Stunden" },
  { value: 12, label: "Alle 12 Stunden" },
  { value: 24, label: "Taeglich" },
  { value: 48, label: "Alle 2 Tage" },
];

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch (_) {
    return value;
  }
}

function intervalLabel(hours) {
  const match = INTERVAL_OPTIONS.find((o) => o.value === Number(hours));
  return match ? match.label : `Alle ${hours} h`;
}

export default function AutoBumpPage() {
  const [loaded, setLoaded] = useState(false);
  const [rules, setRules] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ listing_id: "", interval_hours: 24 });
  const [creating, setCreating] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setPageError("");
    try {
      const [rulesRes, listingsRes] = await Promise.all([
        api.get("/listings/auto-bump"),
        api.get("/listings/all"),
      ]);
      setRules(Array.isArray(rulesRes.data) ? rulesRes.data : []);
      setListings(Array.isArray(listingsRes.data) ? listingsRes.data : []);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (!loaded) {
    setLoaded(true);
    loadAll();
  }

  // Map listing kleinanzeigen_id -> title for the rule rows
  const listingTitleById = useMemo(() => {
    const map = new Map();
    for (const l of listings) {
      map.set(String(l.kleinanzeigen_id), l.title);
    }
    return map;
  }, [listings]);

  // For the dropdown: only show listings without an existing rule
  const availableListings = useMemo(() => {
    const used = new Set(rules.map((r) => String(r.listing_id)));
    return listings.filter((l) => !used.has(String(l.kleinanzeigen_id)));
  }, [listings, rules]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.listing_id) {
      setPageError("Bitte Inserat auswaehlen.");
      return;
    }
    setCreating(true);
    setPageError("");
    setPageNotice("");
    try {
      const res = await api.post("/listings/auto-bump", {
        listing_id: form.listing_id,
        interval_hours: Number(form.interval_hours),
      });
      // Optimistic: append, then refresh in background
      if (res?.data?.id) {
        setRules((prev) => [...prev, res.data]);
      } else {
        await loadAll();
      }
      setPageNotice("Regel angelegt.");
      setCreateOpen(false);
      setForm({ listing_id: "", interval_hours: 24 });
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (rule) => {
    setBusyId(String(rule.id));
    setPageError("");
    setPageNotice("");
    const nextActive = !rule.is_active;
    try {
      const res = await api.patch(`/listings/auto-bump/${rule.id}`, { is_active: nextActive });
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, ...(res?.data || { is_active: nextActive }) } : r)));
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setBusyId("");
    }
  };

  const handleDelete = async (rule) => {
    if (!window.confirm(`Auto-Bump fuer "${listingTitleById.get(String(rule.listing_id)) || rule.listing_id}" wirklich loeschen?`)) {
      return;
    }
    setBusyId(String(rule.id));
    setPageError("");
    setPageNotice("");
    try {
      await api.delete(`/listings/auto-bump/${rule.id}`);
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      setPageNotice("Regel geloescht.");
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>{"⏱️"} Auto-Bump</p>
            <h1 className="mt-1 text-2xl font-semibold" style={{ color: "var(--text)" }}>Inserate automatisch hochschieben</h1>
            <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>
              Lege fest, in welchem Rhythmus ein Inserat automatisch nach oben geschoben wird. Jede Regel laeuft, solange sie aktiv ist.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setCreateOpen((v) => !v); setPageError(""); setPageNotice(""); }}
            disabled={loading || availableListings.length === 0}
            className="btn-primary shrink-0"
          >
            {createOpen ? "Schliessen" : `${"+"} Neue Regel`}
          </button>
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

        {createOpen && (
          <form onSubmit={handleCreate} className="mt-4 grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_200px_auto]" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div>
              <label className="label">Inserat</label>
              <select
                value={form.listing_id}
                onChange={(e) => setForm((f) => ({ ...f, listing_id: e.target.value }))}
                className="input"
                required
                disabled={creating || availableListings.length === 0}
              >
                <option value="">Inserat waehlen...</option>
                {availableListings.map((l) => (
                  <option key={l.kleinanzeigen_id} value={l.kleinanzeigen_id}>
                    {l.title}
                  </option>
                ))}
              </select>
              {availableListings.length === 0 && (
                <p className="mt-1 text-xs" style={{ color: "var(--text-subtle)" }}>
                  Alle Inserate haben bereits eine Regel.
                </p>
              )}
            </div>
            <div>
              <label className="label">Intervall</label>
              <select
                value={form.interval_hours}
                onChange={(e) => setForm((f) => ({ ...f, interval_hours: Number(e.target.value) }))}
                className="input"
                disabled={creating}
              >
                {INTERVAL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full sm:w-auto" disabled={creating || !form.listing_id}>
                {creating ? "Speichert..." : "Speichern"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="card">
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>Aktive Regeln</h2>
        <p className="mt-1 text-xs" style={{ color: "var(--text-subtle)" }}>
          {rules.length === 0 ? "Noch keine Regel angelegt." : `${rules.length} Regel${rules.length === 1 ? "" : "n"}`}
        </p>

        {loading && rules.length === 0 && (
          <div className="mt-4 space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg" style={{ background: "var(--bg)" }} />
            ))}
          </div>
        )}

        {!loading && rules.length === 0 && (
          <div
            className="mt-4 rounded-lg border border-dashed p-5 text-sm"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            Lege eine erste Regel an, um Inserate automatisch hochschieben zu lassen.
          </div>
        )}

        {rules.length > 0 && (
          <ul className="mt-4 divide-y" style={{ borderColor: "var(--border)" }}>
            {rules.map((rule) => {
              const title = listingTitleById.get(String(rule.listing_id)) || `Inserat ${rule.listing_id}`;
              const isBusy = busyId === String(rule.id);
              return (
                <li key={rule.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "var(--text-subtle)" }}>
                      <span>{"⏱️"} {intervalLabel(rule.interval_hours)}</span>
                      <span>Naechster Bump: {formatDate(rule.next_run_at)}</span>
                      {rule.last_run_at && <span>Letzter: {formatDate(rule.last_run_at)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                      <input
                        type="checkbox"
                        checked={Boolean(rule.is_active)}
                        onChange={() => handleToggle(rule)}
                        disabled={isBusy}
                        className="h-4 w-4"
                      />
                      <span>{rule.is_active ? "Aktiv" : "Pausiert"}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDelete(rule)}
                      disabled={isBusy}
                      className="rounded-lg border px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500 hover:text-white disabled:opacity-60 dark:text-red-400 dark:hover:text-white"
                      style={{ borderColor: "rgb(220 38 38 / 0.4)" }}
                    >
                      {isBusy ? "..." : "Loeschen"}
                    </button>
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
