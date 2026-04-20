import { useState } from "react";
import api from "../lib/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

function formatAxisDate(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(d);
  } catch {
    return isoStr;
  }
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="mb-1 text-slate-500">{formatAxisDate(label)}</div>
      {payload.map((entry) => (
        <div key={entry.name} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {entry.value ?? "-"}
        </div>
      ))}
    </div>
  );
}

export default function ListingStatsChart({ listing }) {
  const [loaded, setLoaded] = useState(false);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!loaded) {
    setLoaded(true);
    setLoading(true);
    api.get(`/listings/${listing.kleinanzeigen_id}/stats`)
      .then((res) => {
        // Sort ascending for chart display
        const sorted = [...res.data].sort(
          (a, b) => new Date(a.scraped_at) - new Date(b.scraped_at)
        );
        setStats(sorted);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || err?.message || "Fehler beim Laden.");
      })
      .finally(() => setLoading(false));
  }

  if (loading) {
    return (
      <div className="mt-2 h-32 animate-pulse rounded-lg bg-slate-100" />
    );
  }

  if (error) {
    return <div className="mt-2 text-xs text-red-500">{error}</div>;
  }

  if (!stats || stats.length === 0) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
        Noch keine Statistik-Daten. Daten werden beim nächsten Scrape gesammelt.
      </div>
    );
  }

  return (
    <div className="mt-2">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={stats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="scraped_at"
            tickFormatter={formatAxisDate}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Line
            type="monotone"
            dataKey="view_count"
            name="Views"
            stroke="var(--accent, #2563eb)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="bookmark_count"
            name="Gemerkt"
            stroke="#e11d48"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
