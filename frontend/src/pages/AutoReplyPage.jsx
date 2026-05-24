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

export default function AutoReplyPage() {
  const [loaded, setLoaded] = useState(false);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [form, setForm] = useState({
    trigger_text: "",
    reply_text: "",
    is_active: true,
  });

  const loadRules = async () => {
    setLoading(true);
    setPageError("");
    try {
      const response = await api.get("/auto-replies");
      setRules(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (!loaded) {
    setLoaded(true);
    loadRules();
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.trigger_text.trim() || !form.reply_text.trim()) {
      setPageError("Bitte Trigger und Antwort ausfüllen.");
      return;
    }

    setSaving(true);
    setPageError("");
    setPageNotice("");
    try {
      await api.post("/auto-replies", {
        trigger_text: form.trigger_text.trim(),
        reply_text: form.reply_text.trim(),
        is_active: !!form.is_active,
      });
      setForm({ trigger_text: "", reply_text: "", is_active: true });
      setPageNotice("Auto-Antwort gespeichert.");
      await loadRules();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule) => {
    setActiveId(String(rule.id));
    setPageError("");
    setPageNotice("");
    try {
      await api.post("/auto-replies", {
        id: rule.id,
        trigger_text: rule.trigger_text || "",
        reply_text: rule.reply_text || "",
        is_active: !rule.is_active,
      });
      setPageNotice("Status aktualisiert.");
      await loadRules();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setActiveId("");
    }
  };

  const handleDelete = async (ruleId) => {
    if (!window.confirm("Regel wirklich löschen?")) return;

    setActiveId(String(ruleId));
    setPageError("");
    setPageNotice("");
    try {
      await api.delete(`/auto-replies/${ruleId}`);
      setPageNotice("Regel gelöscht.");
      await loadRules();
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
              <h1 className="text-2xl font-bold">{'🤖'} Auto-Antworten</h1>
              <p className="mt-2 text-sm opacity-70">
                Trigger definieren, automatische Antworten speichern und einzelne Regeln gezielt aktivieren.
              </p>
            </div>
            <button
              type="button"
              onClick={loadRules}
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
          <h2 className="text-lg font-semibold">{'📝'} Neue Regel</h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Trigger-Text</label>
              <input
                type="text"
                value={form.trigger_text}
                onChange={(event) => setForm({ ...form, trigger_text: event.target.value })}
                placeholder="z. B. letzter Preis"
                className="w-full rounded-xl px-3 py-3 text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Antwort-Text</label>
              <textarea
                value={form.reply_text}
                onChange={(event) => setForm({ ...form, reply_text: event.target.value })}
                placeholder="Hallo, der Preis ist aktuell fest."
                rows={5}
                className="w-full rounded-xl px-3 py-3 text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <label className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm" style={inputStyle}>
              <input
                type="checkbox"
                checked={!!form.is_active}
                onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                className="h-5 w-5"
              />
              Aktiv speichern
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
            <h2 className="text-lg font-semibold">{'📋'} Regeln</h2>
            <span className="text-sm opacity-70">{rules.length} Einträge</span>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-xl px-4 py-4 text-sm opacity-70" style={inputStyle}>
                Regeln werden geladen...
              </div>
            ) : rules.length === 0 ? (
              <div className="rounded-xl px-4 py-4 text-sm opacity-70" style={inputStyle}>
                Noch keine Auto-Antwort-Regeln vorhanden.
              </div>
            ) : (
              rules.map((rule) => (
                <div key={rule.id} className="rounded-2xl p-4" style={inputStyle}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">Trigger: {rule.trigger_text || "-"}</div>
                      <div className="mt-2 whitespace-pre-wrap text-sm opacity-80">
                        {rule.reply_text || "Keine Antwort hinterlegt"}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 md:min-w-[180px]">
                      <label className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm" style={cardStyle}>
                        <span>Aktiv</span>
                        <input
                          type="checkbox"
                          checked={!!rule.is_active}
                          disabled={activeId === String(rule.id)}
                          onChange={() => handleToggle(rule)}
                          className="h-5 w-5"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleDelete(rule.id)}
                        disabled={activeId === String(rule.id)}
                        className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white"
                      >
                        {activeId === String(rule.id) ? "..." : "Löschen"}
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
