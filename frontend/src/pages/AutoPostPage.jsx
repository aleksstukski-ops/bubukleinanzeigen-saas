import { useState } from "react";
import api from "../lib/api";
import { subscribeEvents } from "../lib/events";
import Modal from "../components/Modal";

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || "Aktion fehlgeschlagen.";
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

const STATUS_META = {
  queued:  { label: "Wartet",         cls: "bg-slate-100 text-slate-700 border border-slate-200" },
  posting: { label: "Wird inseriert", cls: "bg-blue-100 text-blue-700 border border-blue-200" },
  posted:  { label: "Online",         cls: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  failed:  { label: "Fehler",         cls: "bg-red-100 text-red-700 border border-red-200" },
};

const EMPTY_DRAFT = { account_id: "", title: "", description: "", price: "", category_id: "", location: "" };

export default function AutoPostPage() {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [queue, setQueue] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [savingScheduleId, setSavingScheduleId] = useState(null);
  const [scheduleDrafts, setScheduleDrafts] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [draftTemplateId, setDraftTemplateId] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [formError, setFormError] = useState("");
  const [eventsBound, setEventsBound] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setPageError("");
    try {
      const [accountsRes, schedulesRes, queueRes, templatesRes] = await Promise.all([
        api.get("/ka-accounts"),
        api.get("/posting/schedules"),
        api.get("/posting/queue?include_done=true"),
        api.get("/templates").catch(() => ({ data: [] })),
      ]);
      setAccounts(accountsRes.data || []);
      setSchedules(schedulesRes.data || []);
      setQueue(queueRes.data || []);
      setTemplates(templatesRes.data || []);
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

  if (!eventsBound && loaded) {
    setEventsBound(true);
    subscribeEvents((event) => {
      if (event.type === "listing.created") {
        loadAll();
      }
    });
  }

  const scheduleFor = (accountId) => {
    const existing = schedules.find((s) => s.account_id === accountId);
    const local = scheduleDrafts[accountId];
    return {
      is_enabled: local?.is_enabled ?? existing?.is_enabled ?? false,
      posts_per_day: local?.posts_per_day ?? existing?.posts_per_day ?? 3,
      window_start_hour: local?.window_start_hour ?? existing?.window_start_hour ?? 9,
      window_end_hour: local?.window_end_hour ?? existing?.window_end_hour ?? 18,
      posted_today: existing?.posted_today ?? 0,
      last_posted_at: existing?.last_posted_at ?? null,
    };
  };

  const updateScheduleDraft = (accountId, patch) => {
    setScheduleDrafts((current) => ({
      ...current,
      [accountId]: { ...scheduleFor(accountId), ...(current[accountId] || {}), ...patch },
    }));
  };

  const saveSchedule = async (accountId) => {
    const values = scheduleFor(accountId);
    setSavingScheduleId(accountId);
    setPageError("");
    try {
      const response = await api.put(`/posting/schedules/${accountId}`, {
        is_enabled: values.is_enabled,
        posts_per_day: Number(values.posts_per_day),
        window_start_hour: Number(values.window_start_hour),
        window_end_hour: Number(values.window_end_hour),
      });
      setSchedules((current) => {
        const rest = current.filter((s) => s.account_id !== accountId);
        return [...rest, response.data];
      });
      setScheduleDrafts((current) => {
        const next = { ...current };
        delete next[accountId];
        return next;
      });
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setSavingScheduleId(null);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setDraft(EMPTY_DRAFT);
    setDraftTemplateId("");
    setFormError("");
    setSavingDraft(false);
  };

  const applyTemplate = (templateId) => {
    setDraftTemplateId(templateId);
    if (!templateId) return;
    const template = templates.find((t) => String(t.id) === String(templateId));
    if (!template) return;
    setDraft((current) => ({
      ...current,
      title: template.title || current.title,
      description: template.description || current.description,
      price: template.price || current.price,
      category_id: template.category_id || current.category_id,
      location: template.location || current.location,
    }));
  };

  const handleAddDraft = async (event) => {
    event.preventDefault();
    if (!draft.account_id) {
      setFormError("Bitte ein Konto auswaehlen.");
      return;
    }
    setSavingDraft(true);
    setFormError("");
    try {
      const response = await api.post("/posting/queue", {
        account_id: Number(draft.account_id),
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        price: draft.price.trim() || null,
        category_id: draft.category_id.trim() || null,
        location: draft.location.trim() || null,
      });
      setQueue((current) => [...current, response.data]);
      closeModal();
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSavingDraft(false);
    }
  };

  const handleDelete = async (item) => {
    setPageError("");
    try {
      await api.delete(`/posting/queue/${item.id}`);
      setQueue((current) => current.filter((q) => q.id !== item.id));
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  };

  const handleRetry = async (item) => {
    setPageError("");
    try {
      const response = await api.post(`/posting/queue/${item.id}/retry`);
      setQueue((current) => current.map((q) => (q.id === item.id ? response.data : q)));
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  };

  const accountLabel = (accountId) =>
    accounts.find((a) => a.id === accountId)?.label || `Konto ${accountId}`;

  const queuedCount = queue.filter((q) => q.status === "queued").length;
  const postedCount = queue.filter((q) => q.status === "posted").length;

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Automatisierung</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{'🗓️'} Auto-Posting</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Lege pro Konto fest, wie viele Inserate pro Tag automatisch online gehen.
              BubuBay verteilt die Entwuerfe aus der Warteschlange gleichmaessig ueber dein Zeitfenster.
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
            {'➕'} Entwurf hinzufuegen
          </button>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="text-sm text-slate-500">In Warteschlange</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{loading ? "..." : queuedCount}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="text-sm text-slate-500">Automatisch inseriert</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{loading ? "..." : postedCount}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="text-sm text-slate-500">Aktive Plaene</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">
              {loading ? "..." : schedules.filter((s) => s.is_enabled).length}
            </div>
          </div>
        </div>

        {pageError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{pageError}</div>
        ) : null}
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900">Zeitplaene pro Konto</h2>
        <p className="mt-1 text-sm text-slate-500">
          Beispiel: 3 Inserate pro Tag zwischen 9 und 18 Uhr — BubuBay postet dann ca. alle 3 Stunden eins.
        </p>

        {!loading && accounts.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
            Noch keine Konten verbunden.
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {accounts.map((account) => {
            const values = scheduleFor(account.id);
            const dirty = Boolean(scheduleDrafts[account.id]);
            return (
              <div key={account.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-medium text-slate-900">{account.label}</div>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${values.is_enabled ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200"}`}>
                        {values.is_enabled ? "Aktiv" : "Pausiert"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Heute inseriert: {values.posted_today} · Zuletzt: {formatDate(values.last_posted_at)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={values.is_enabled}
                        onChange={(e) => updateScheduleDraft(account.id, { is_enabled: e.target.checked })}
                        className="h-5 w-5 rounded border-slate-300 text-blue-600"
                      />
                      Aktiv
                    </label>
                    <div>
                      <label className="label">Pro Tag</label>
                      <input
                        type="number" min="1" max="50"
                        value={values.posts_per_day}
                        onChange={(e) => updateScheduleDraft(account.id, { posts_per_day: e.target.value })}
                        className="input w-20"
                      />
                    </div>
                    <div>
                      <label className="label">Von (Uhr)</label>
                      <input
                        type="number" min="0" max="23"
                        value={values.window_start_hour}
                        onChange={(e) => updateScheduleDraft(account.id, { window_start_hour: e.target.value })}
                        className="input w-20"
                      />
                    </div>
                    <div>
                      <label className="label">Bis (Uhr)</label>
                      <input
                        type="number" min="1" max="24"
                        value={values.window_end_hour}
                        onChange={(e) => updateScheduleDraft(account.id, { window_end_hour: e.target.value })}
                        className="input w-20"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!dirty || savingScheduleId === account.id}
                      onClick={() => saveSchedule(account.id)}
                    >
                      {savingScheduleId === account.id ? "Speichert..." : "Speichern"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold text-slate-900">Warteschlange</h2>
        <p className="mt-1 text-sm text-slate-500">
          Diese Entwuerfe werden der Reihe nach automatisch veroeffentlicht.
        </p>

        {!loading && queue.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
            Noch keine Entwuerfe. Lege welche an oder uebernimm eine Vorlage.
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {queue.map((item) => {
            const meta = STATUS_META[item.status] || STATUS_META.queued;
            return (
              <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-semibold text-slate-900">{item.title}</div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${meta.cls}`}>{meta.label}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{accountLabel(item.account_id)}</span>
                    {item.price ? <span>{item.price}</span> : null}
                    {item.posted_at ? <span>Online seit {formatDate(item.posted_at)}</span> : null}
                  </div>
                  {item.error ? (
                    <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{item.error}</div>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  {item.status === "failed" ? (
                    <button type="button" className="btn-secondary" onClick={() => handleRetry(item)}>
                      {'🔁'} Erneut
                    </button>
                  ) : null}
                  {item.status !== "posting" ? (
                    <button type="button" className="btn-secondary" onClick={() => handleDelete(item)}>
                      {'🗑️'} Entfernen
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title="Entwurf fuer Auto-Posting"
        description="Wird automatisch veroeffentlicht, sobald der Zeitplan des Kontos es vorsieht."
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={closeModal}>Abbrechen</button>
            <button type="submit" form="autopost-draft-form" className="btn-primary" disabled={savingDraft}>
              {savingDraft ? "Speichert..." : "In Warteschlange"}
            </button>
          </div>
        }
      >
        <form id="autopost-draft-form" className="space-y-4" onSubmit={handleAddDraft}>
          <div>
            <label className="label">Konto</label>
            <select
              className="input"
              value={draft.account_id}
              onChange={(e) => setDraft((c) => ({ ...c, account_id: e.target.value }))}
              required
            >
              <option value="">Bitte waehlen</option>
              {accounts.map((account) => (
                <option key={account.id} value={String(account.id)}>{account.label}</option>
              ))}
            </select>
          </div>
          {templates.length > 0 ? (
            <div>
              <label className="label">Aus Vorlage uebernehmen (optional)</label>
              <select className="input" value={draftTemplateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">Keine Vorlage</option>
                {templates.map((template) => (
                  <option key={template.id} value={String(template.id)}>{template.name}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className="label">Titel</label>
            <input
              type="text" className="input" maxLength={500} required
              value={draft.title}
              onChange={(e) => setDraft((c) => ({ ...c, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Beschreibung</label>
            <textarea
              className="input min-h-[120px]"
              value={draft.description}
              onChange={(e) => setDraft((c) => ({ ...c, description: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Preis (z. B. 25 EUR oder VB)</label>
              <input
                type="text" className="input" maxLength={64}
                value={draft.price}
                onChange={(e) => setDraft((c) => ({ ...c, price: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Ort / PLZ</label>
              <input
                type="text" className="input" maxLength={255}
                value={draft.location}
                onChange={(e) => setDraft((c) => ({ ...c, location: e.target.value }))}
              />
            </div>
          </div>
          {formError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
