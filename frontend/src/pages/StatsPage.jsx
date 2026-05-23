import { useState } from "react";
import api from "../lib/api";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function truncate(str, len) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

export default function StatsPage() {
  const [listings, setListings] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedListing, setSelectedListing] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("all");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [listingsRes, accountsRes] = await Promise.all([
        api.get("/listings/all"),
        api.get("/ka-accounts"),
      ]);
      setListings(listingsRes.data || []);
      setAccounts(accountsRes.data || []);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  if (!loaded) {
    setLoaded(true);
    load();
  }

  const accountLabelById = new Map();
  for (const acc of accounts) {
    accountLabelById.set(acc.id, acc.label || `Konto ${acc.id}`);
  }

  const filtered = selectedAccountId === "all"
    ? listings
    : listings.filter((l) => String(l.account_id) === selectedAccountId);

  const totalViews = filtered.reduce((s, l) => s + Number(l.view_count || 0), 0);
  const totalBookmarks = filtered.reduce((s, l) => s + Number(l.bookmark_count || 0), 0);
  const activeCount = filtered.filter((l) => l.is_active).length;

  const topByViews = [...filtered]
    .sort((a, b) => Number(b.view_count || 0) - Number(a.view_count || 0))
    .slice(0, 15)
    .map((l) => ({
      name: truncate(l.title, 14),
      views: Number(l.view_count || 0),
      bookmarks: Number(l.bookmark_count || 0),
      id: l.kleinanzeigen_id,
    }));

  const loadHistory = async (listing) => {
    setSelectedListing(listing);
    setHistoryLoading(true);
    setHistory([]);
    try {
      const res = await api.get(`/listings/${listing.kleinanzeigen_id}/stats`);
      const data = (res.data || [])
        .sort((a, b) => new Date(a.scraped_at) - new Date(b.scraped_at))
        .map((s) => ({
          date: new Date(s.scraped_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
          views: Number(s.view_count || 0),
          bookmarks: Number(s.bookmark_count || 0),
        }));
      setHistory(data);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-slate-900">{'📊'} Statistiken</h1>
        <div className="flex items-center gap-3">
          {accounts.length > 1 && (
            <select
              value={selectedAccountId}
              onChange={(e) => { setSelectedAccountId(e.target.value); setSelectedListing(null); }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">Alle Konten</option>
              {accounts.map((a) => (
                <option key={a.id} value={String(a.id)}>{a.label || `Konto ${a.id}`}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "..." : "Aktualisieren"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Summary cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Inserate", value: filtered.length, icon: "📦" },
          { label: "Aktiv", value: activeCount, icon: "🟢" },
          { label: "Views gesamt", value: totalViews.toLocaleString("de-DE"), icon: "👁️" },
          { label: "Gemerkt gesamt", value: totalBookmarks.toLocaleString("de-DE"), icon: "💾" },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-1 text-xs font-medium text-slate-500">{card.icon}{" "}{card.label}</div>
            <div className="text-2xl font-bold text-slate-900">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Top listings bar chart */}
      {topByViews.length > 0 && (
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Top Inserate nach Views</h2>
          <div style={{ width: "100%", height: Math.max(250, topByViews.length * 32) }}>
            <ResponsiveContainer>
              <BarChart data={topByViews} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
                  formatter={(value, name) => [value.toLocaleString("de-DE"), name === "views" ? "Views" : "Gemerkt"]}
                />
                <Bar
                  dataKey="views"
                  fill="#3b82f6"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    const listing = filtered.find((l) => l.kleinanzeigen_id === data.id);
                    if (listing) loadHistory(listing);
                  }}
                />
                <Bar dataKey="bookmarks" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-slate-400">Klick auf einen Balken fuer den Verlauf</p>
        </div>
      )}

      {/* History line chart for selected listing */}
      {selectedListing && (
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              {'📈'} Verlauf: {truncate(selectedListing.title, 40)}
            </h2>
            <button
              type="button"
              onClick={() => setSelectedListing(null)}
              className="text-sm text-slate-400 hover:text-slate-600"
            >
              Schliessen
            </button>
          </div>
          {historyLoading ? (
            <div className="py-12 text-center text-sm text-slate-400">Lade Verlauf...</div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">Noch keine Verlaufsdaten vorhanden</div>
          ) : (
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <LineChart data={history} margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
                    formatter={(value, name) => [value.toLocaleString("de-DE"), name === "views" ? "Views" : "Gemerkt"]}
                  />
                  <Line type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="bookmarks" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Listings table */}
      {filtered.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-base font-semibold text-slate-900">Alle Inserate</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-3 sm:px-4">Inserat</th>
                  <th className="hidden px-3 py-3 text-right sm:table-cell">Preis</th>
                  <th className="px-3 py-3 text-right sm:px-4">Views</th>
                  <th className="px-3 py-3 text-right sm:px-4">Gemerkt</th>
                  <th className="hidden px-3 py-3 text-center sm:table-cell">Konto</th>
                </tr>
              </thead>
              <tbody>
                {[...filtered]
                  .sort((a, b) => Number(b.view_count || 0) - Number(a.view_count || 0))
                  .map((l) => (
                    <tr
                      key={l.kleinanzeigen_id}
                      className="cursor-pointer border-b border-slate-50 hover:bg-slate-50 transition-colors"
                      style={{ minHeight: "44px" }}
                      onClick={() => loadHistory(l)}
                    >
                      <td className="max-w-[140px] truncate px-3 py-3 font-medium text-slate-800 sm:max-w-[200px] sm:px-4">
                        {l.title || "—"}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 text-right text-slate-600 sm:table-cell">
                        {l.price || "—"}
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-blue-600 sm:px-4">
                        {Number(l.view_count || 0).toLocaleString("de-DE")}
                      </td>
                      <td className="px-3 py-3 text-right text-amber-600 sm:px-4">
                        {Number(l.bookmark_count || 0).toLocaleString("de-DE")}
                      </td>
                      <td className="hidden px-3 py-3 text-center text-xs text-slate-500 sm:table-cell">
                        {accountLabelById.get(l.account_id) || `#${l.account_id}`}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="py-16 text-center text-sm text-slate-400">
          Keine Inserate gefunden. Verbinde zuerst ein Konto und synchronisiere deine Inserate.
        </div>
      )}
    </div>
  );
}
