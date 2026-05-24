import { useState } from "react";
import api from "../lib/api";

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || "Aktion fehlgeschlagen.";
}

const surfaceStyle = {
  color: "var(--text)",
  background: "var(--surface)",
};

const cardStyle = {
  ...surfaceStyle,
  border: "1px solid rgba(148, 163, 184, 0.2)",
};

const inputStyle = {
  ...surfaceStyle,
  border: "1px solid rgba(148, 163, 184, 0.25)",
};

export default function WatchesPage() {
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [form, setForm] = useState({
    search_term: "",
    push_enabled: true,
  });

  const loadItems = async () => {
    setLoading(true);
    setPageError("");
    try {
      const response = await api.get("/watches");
      setItems(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (!loaded) {
    setLoaded(true);
    loadItems();
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.search_term.trim()) {
      setPageError("Bitte einen Suchbegriff eingeben.");
      return;
    }

    setSaving(true);
    setPageError("");
    setPageNotice("");
    try {
      await api.post("/watches", {
        search_term: form.search_term.trim(),
        push_enabled: !!form.push_enabled,
      });
      setForm({ search_term: "", push_enabled: true });
      setPageNotice("Monitor gespeichert.");
      await loadItems();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item) => {
    setActiveId(String(item.id));
    setPageError("");
    setPageNotice("");
    try {
      await api.post("/watches", {
        id: item.id,
        search_term: item.search_term || "",
        push_enabled: !item.push_enabled,
      });
      setPageNotice("Push-Einstellung aktualisiert.");
      await loadItems();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setActiveId("");
    }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm("Monitor wirklich löschen?")) return;

    setActiveId(String(itemId));
    setPageError("");
    setPageNotice("");
    try {
      await api.delete(`/watches/${itemId}`);
      setPageNotice("Monitor gelöscht.");
      await loadItems();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setActiveId("");
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 md:px-6" style={surfaceStyle}>
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-2xl p-5 shadow-sm" style={cardStyle}>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">{'🔎'} Watches</h1>
              <p className="mt-2 text-sm opacity-70">
                Suchbegriffe als Kategorie-Monitore anlegen und Push-Benachrichtigungen pro Monitor steuern.
              </p>
            </div>
            <button
              type="button"
              onClick={loadItems}
              disabled={loading}
              className="rounded-xl px-4 py-2 text-sm font-medium"
              style={inputStyle}
            >
              {loading ? "Lädt..." : "Neu laden"}
            </button>
          </div>
        </section>

        {pageError ? (
          <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {pageError}
          </div>
        ) : null}

        {pageNotice ? (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {pageNotice}
          </div>
        ) : null}

        <section className="rounded-2xl p-5 shadow-sm" style={cardStyle}>
          <h2 className="text-lg font-semibold">{'➕'} Neuer Monitor</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Suchbegriff</label>
              <input
                type="text"
                value={form.search_term}
                onChange={(event) => setForm({ ...form, search_term: event.target.value })}
                placeholder="z. B. PlayStation 5"
                className="w-full rounded-xl px-3 py-3 text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <label className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm" style={inputStyle}>
              <input
                type="checkbox"
                checked={!!form.push_enabled}
                onChange={(event) => setForm({ ...form, push_enabled: event.target.checked })}
                className="h-5 w-5"
              />
              Push-Benachrichtigung aktivieren
            </label>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
            >
              {saving ? "Speichert..." : "Speichern"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl p-5 shadow-sm" style={cardStyle}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{'📋'} Monitore</h2>
            <span className="text-sm opacity-70">{items.length} Einträge</span>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-xl px-4 py-4 text-sm opacity-70" style={inputStyle}>
                Monitore werden geladen...
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-xl px-4 py-4 text-sm opacity-70" style={inputStyle}>
                Noch keine Monitore vorhanden.
              </div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="rounded-2xl p-4" style={inputStyle}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold">{item.search_term || "-"}</div>
                      <div className="mt-1 text-sm opacity-70">
                        Push: {item.push_enabled ? "aktiv" : "deaktiviert"}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 md:min-w-[180px]">
                      <label className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm" style={cardStyle}>
                        <span>Push</span>
                        <input
                          type="checkbox"
                          checked={!!item.push_enabled}
                          disabled={activeId === String(item.id)}
                          onChange={() => handleToggle(item)}
                          className="h-5 w-5"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={activeId === String(item.id)}
                        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white"
                      >
                        {activeId === String(item.id) ? "..." : "Löschen"}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
