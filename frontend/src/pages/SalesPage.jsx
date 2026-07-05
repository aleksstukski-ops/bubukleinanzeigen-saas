import { useState } from "react";
import api from "../lib/api";
import Modal from "../components/Modal";

function getErrorMessage(error) {
  return error?.response?.data?.detail || error?.message || "Aktion fehlgeschlagen.";
}

function formatEuro(value) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

// Pipeline stages in order. Keys match the backend SALE_STATUSES.
const STAGES = [
  { key: "reserved",          label: "Reserviert",        icon: "🔒", color: "border-amber-300" },
  { key: "awaiting_payment",  label: "Auf Zahlung",       icon: "💶", color: "border-blue-300" },
  { key: "awaiting_shipping", label: "Versand faellig",   icon: "📦", color: "border-violet-300" },
  { key: "awaiting_pickup",   label: "Abholung faellig",  icon: "🤝", color: "border-violet-300" },
  { key: "completed",         label: "Abgeschlossen",     icon: "✅", color: "border-emerald-300" },
  { key: "cancelled",         label: "Abgebrochen",       icon: "❌", color: "border-red-300" },
];

const STAGE_LABELS = Object.fromEntries(STAGES.map((s) => [s.key, s.label]));

export default function SalesPage() {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [listings, setListings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ sale_status: "", sold_price: "", buyer_name: "", sale_note: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    setPageError("");
    try {
      const [listingsRes, summaryRes, accountsRes] = await Promise.all([
        api.get("/listings/all"),
        api.get("/listings/sales-summary"),
        api.get("/ka-accounts"),
      ]);
      setListings(listingsRes.data || []);
      setSummary(summaryRes.data || null);
      setAccounts(accountsRes.data || []);
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

  const accountLabel = (accountId) =>
    accounts.find((a) => a.id === accountId)?.label || `Konto ${accountId}`;

  const inPipeline = listings.filter((l) => l.sale_status);
  const available = listings.filter((l) => !l.sale_status && l.is_active);

  const byStage = Object.fromEntries(STAGES.map((s) => [s.key, []]));
  for (const listing of inPipeline) {
    if (byStage[listing.sale_status]) byStage[listing.sale_status].push(listing);
  }

  const openEdit = (listing, presetStatus) => {
    setEditItem(listing);
    setEditForm({
      sale_status: presetStatus || listing.sale_status || "reserved",
      sold_price: listing.sold_price || listing.price || "",
      buyer_name: listing.buyer_name || "",
      sale_note: listing.sale_note || "",
    });
    setFormError("");
  };

  const saveSale = async (event) => {
    event.preventDefault();
    if (!editItem) return;
    setSaving(true);
    setFormError("");
    try {
      const response = await api.patch(`/listings/sale/${editItem.id}`, {
        sale_status: editForm.sale_status || null,
        sold_price: editForm.sold_price,
        buyer_name: editForm.buyer_name,
        sale_note: editForm.sale_note,
      });
      setListings((current) => current.map((l) => (l.id === editItem.id ? response.data : l)));
      setEditItem(null);
      const summaryRes = await api.get("/listings/sales-summary").catch(() => null);
      if (summaryRes) setSummary(summaryRes.data);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const clearSale = async (listing) => {
    setPageError("");
    try {
      const response = await api.patch(`/listings/sale/${listing.id}`, { sale_status: null });
      setListings((current) => current.map((l) => (l.id === listing.id ? response.data : l)));
      const summaryRes = await api.get("/listings/sales-summary").catch(() => null);
      if (summaryRes) setSummary(summaryRes.data);
    } catch (error) {
      setPageError(getErrorMessage(error));
    }
  };

  const addToPipeline = async (event) => {
    event.preventDefault();
    const listing = available.find((l) => String(l.id) === String(selectedListingId));
    if (!listing) return;
    setModalOpen(false);
    setSelectedListingId("");
    openEdit(listing, "reserved");
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Verkaufsabwicklung</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{'💰'} Verkaeufe</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Fuehre Inserate vom Reservieren bis zum Abschluss durch die Pipeline —
              inklusive Kaeufer, Verkaufspreis und Notizen.
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
            {'➕'} Inserat in Pipeline
          </button>
        </div>

        {summary ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Aktive Inserate (Wert)</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{formatEuro(summary.active_value)}</div>
            </div>
            <div className="rounded-lg bg-amber-50 p-4">
              <div className="text-sm text-amber-700">Reserviert</div>
              <div className="mt-2 text-2xl font-semibold text-amber-700">{formatEuro(summary.reserved_value)}</div>
            </div>
            <div className="rounded-lg bg-blue-50 p-4">
              <div className="text-sm text-blue-700">In Abwicklung</div>
              <div className="mt-2 text-2xl font-semibold text-blue-700">{formatEuro(summary.pipeline_value)}</div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-4">
              <div className="text-sm text-emerald-700">Verkauft (gesamt)</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-700">{formatEuro(summary.sold_value)}</div>
            </div>
          </div>
        ) : null}

        {pageError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{pageError}</div>
        ) : null}
      </section>

      {loading ? (
        <section className="card">
          <div className="space-y-3">
            <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-16 animate-pulse rounded-lg bg-slate-100" />
          </div>
        </section>
      ) : null}

      {!loading && inPipeline.length === 0 ? (
        <section className="card">
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <div className="text-3xl">{'💰'}</div>
            <div className="mt-2 text-base font-medium text-slate-900">Noch keine Verkaeufe in Abwicklung</div>
            <p className="mt-1 text-sm text-slate-500">
              Nimm ein Inserat in die Pipeline auf, sobald sich ein Kaeufer meldet.
            </p>
          </div>
        </section>
      ) : null}

      {!loading && inPipeline.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {STAGES.map((stage) => (
            <div key={stage.key} className={`card border-t-4 ${stage.color}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">
                  {stage.icon} {stage.label}
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {byStage[stage.key].length}
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {byStage[stage.key].length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                    Leer
                  </div>
                ) : null}
                {byStage[stage.key].map((listing) => (
                  <div key={listing.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="truncate text-sm font-semibold text-slate-900">{listing.title}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>{accountLabel(listing.account_id)}</span>
                      <span className="font-medium text-slate-700">{listing.sold_price || listing.price || "-"}</span>
                      {listing.buyer_name ? <span>{'👤'} {listing.buyer_name}</span> : null}
                      {listing.sold_at ? <span>{formatDate(listing.sold_at)}</span> : null}
                    </div>
                    {listing.sale_note ? (
                      <div className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">{listing.sale_note}</div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary text-xs" onClick={() => openEdit(listing)}>
                        {'✏️'} Bearbeiten
                      </button>
                      <button type="button" className="btn-secondary text-xs" onClick={() => clearSale(listing)}>
                        {'↩️'} Zurueck zu Aktiv
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Inserat in die Verkaufs-Pipeline aufnehmen"
        description="Waehle ein aktives Inserat — im naechsten Schritt legst du Status, Kaeufer und Preis fest."
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>Abbrechen</button>
            <button type="submit" form="sales-add-form" className="btn-primary" disabled={!selectedListingId}>
              Weiter
            </button>
          </div>
        }
      >
        <form id="sales-add-form" className="space-y-4" onSubmit={addToPipeline}>
          <div>
            <label className="label">Inserat</label>
            <select className="input" value={selectedListingId} onChange={(e) => setSelectedListingId(e.target.value)} required>
              <option value="">Bitte waehlen</option>
              {available.map((listing) => (
                <option key={listing.id} value={String(listing.id)}>
                  {listing.title} ({accountLabel(listing.account_id)}{listing.price ? `, ${listing.price}` : ""})
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editItem)}
        onClose={() => setEditItem(null)}
        title={editItem ? editItem.title : ""}
        description="Verkaufsstatus, Kaeufer und Preis pflegen."
        footer={
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={() => setEditItem(null)}>Abbrechen</button>
            <button type="submit" form="sales-edit-form" className="btn-primary" disabled={saving}>
              {saving ? "Speichert..." : "Speichern"}
            </button>
          </div>
        }
      >
        <form id="sales-edit-form" className="space-y-4" onSubmit={saveSale}>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={editForm.sale_status}
              onChange={(e) => setEditForm((c) => ({ ...c, sale_status: e.target.value }))}
            >
              {STAGES.map((stage) => (
                <option key={stage.key} value={stage.key}>{STAGE_LABELS[stage.key]}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Verkaufspreis</label>
              <input
                type="text" className="input" maxLength={64} placeholder="z. B. 25 EUR"
                value={editForm.sold_price}
                onChange={(e) => setEditForm((c) => ({ ...c, sold_price: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Kaeufer</label>
              <input
                type="text" className="input" maxLength={255}
                value={editForm.buyer_name}
                onChange={(e) => setEditForm((c) => ({ ...c, buyer_name: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Notiz</label>
            <textarea
              className="input min-h-[80px]"
              value={editForm.sale_note}
              onChange={(e) => setEditForm((c) => ({ ...c, sale_note: e.target.value }))}
            />
          </div>
          {formError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}
