import { useState } from "react";
import api from "../lib/api";
import Modal from "./Modal";
import ListingStatsChart from "./ListingStatsChart";

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch (error) {
    return value;
  }
}

function formatViews(value) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("de-DE").format(Number(value));
}

function getStatusLabel(listing, isProcessing) {
  if (isProcessing) return "Wird verarbeitet";
  if (listing?.is_active) return "Aktiv";
  return "Inaktiv";
}

function getStatusClass(listing, isProcessing) {
  if (isProcessing) return "border border-amber-200 bg-amber-100 text-amber-800";
  if (listing?.is_active) return "border border-emerald-200 bg-emerald-100 text-emerald-700";
  return "border border-slate-200 bg-slate-100 text-slate-700";
}

const BUMP_INTERVALS = [
  { value: "", label: "Aus" },
  { value: "1", label: "Jeden Tag" },
  { value: "2", label: "Alle 2 Tage" },
  { value: "3", label: "Alle 3 Tage" },
  { value: "5", label: "Alle 5 Tage" },
  { value: "7", label: "Wochentlich" },
  { value: "14", label: "Alle 2 Wochen" },
];

function InlineEditField({ value, onSave, multiline = false, placeholder = "", inputClassName = "" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const startEdit = () => {
    setDraft(value || "");
    setError("");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setError("");
  };

  const commit = async () => {
    const trimmed = (draft || "").trim();
    if (trimmed === (value || "").trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="group flex items-start gap-2">
        <div className="min-w-0 flex-1 whitespace-pre-wrap break-words">{value || <span className="text-slate-400">{placeholder}</span>}</div>
        <button
          type="button"
          onClick={startEdit}
          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-slate-500 opacity-60 hover:bg-slate-100 hover:opacity-100 group-hover:opacity-100"
          aria-label="Bearbeiten"
        >
          {'✏️'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {multiline ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={["input w-full", inputClassName].join(" ")}
          rows={5}
          autoFocus
          disabled={saving}
        />
      ) : (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={["input w-full", inputClassName].join(" ")}
          autoFocus
          disabled={saving}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            if (e.key === "Escape") { cancelEdit(); }
          }}
        />
      )}
      <div className="flex items-center gap-2">
        <button type="button" onClick={commit} disabled={saving} className="btn-primary py-1 px-3 text-xs">
          {saving ? "Speichert..." : "Speichern"}
        </button>
        <button type="button" onClick={cancelEdit} disabled={saving} className="btn-secondary py-1 px-3 text-xs">
          Abbrechen
        </button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}


function AutoBumpSection({ listing, onUpdated }) {
  const current = listing.bump_interval_days ? String(listing.bump_interval_days) : "";
  const [selected, setSelected] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isDirty = selected !== current;

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const intervalDays = selected ? Number(selected) : null;
      const res = await api.patch(`/listings/${listing.kleinanzeigen_id}/bump-schedule`, {
        account_id: listing.account_id,
        bump_interval_days: intervalDays,
      });
      setSuccess(true);
      if (onUpdated) onUpdated(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-xs font-semibold text-slate-500 mb-2">{"⚡"} Auto-Bump</div>
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => { setSelected(e.target.value); setSuccess(false); }}
          className="input flex-1 text-sm py-1.5"
        >
          {BUMP_INTERVALS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn-primary py-1.5 px-3 text-sm"
          onClick={handleSave}
          disabled={saving || !isDirty}
        >
          {saving ? "..." : "Speichern"}
        </button>
      </div>
      {listing.next_bump_at && !isDirty && (
        <div className="mt-2 text-xs text-slate-500">
          Nächster Bump: {formatDate(listing.next_bump_at)}
        </div>
      )}
      {success && <div className="mt-2 text-xs text-emerald-600">{"✓"} Gespeichert</div>}
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
    </div>
  );
}

export default function ListingDetailModal({
  open,
  listing,
  isProcessing = false,
  bumping = false,
  deleting = false,
  onClose,
  onEdit,
  onBump,
  onDelete,
  onListingUpdated,
}) {
  if (!listing) return null;

  const savePrice = async (newPrice) => {
    await api.patch(`/listings/${listing.kleinanzeigen_id}`, {
      account_id: listing.account_id,
      price: newPrice || null,
    });
    if (onListingUpdated) onListingUpdated({ ...listing, price: newPrice });
  };

  const saveDescription = async (newDescription) => {
    await api.patch(`/listings/${listing.kleinanzeigen_id}`, {
      account_id: listing.account_id,
      description: newDescription || null,
    });
    if (onListingUpdated) onListingUpdated({ ...listing, description: newDescription });
  };

  const footer = (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={onEdit} disabled={isProcessing || deleting} className="btn-secondary">Bearbeiten</button>
      <button type="button" onClick={onBump} disabled={isProcessing || bumping || deleting} className="btn-primary">
        {bumping ? "Wird gestartet..." : "Hochschieben"}
      </button>
      <button type="button" onClick={onDelete} disabled={deleting} className="btn-danger">
        {deleting ? "Loscht..." : "Loschen"}
      </button>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="Inserat-Details" footer={footer}>
      <div className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          {listing.image_url ? (
            <img src={listing.image_url} alt={listing.title} className="h-48 w-full object-cover" />
          ) : (
            <div className="flex h-48 items-center justify-center bg-slate-100 text-4xl">{"📷"}</div>
          )}
          <div className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-500">{"📋"} ID: {listing.kleinanzeigen_id}</div>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{listing.title}</h3>
                <div className="mt-2 flex items-center gap-2 text-base font-semibold">
                  <span>{'💰'}</span>
                  <div className="min-w-0 flex-1">
                    <InlineEditField
                      value={listing.price || ""}
                      onSave={savePrice}
                      placeholder="Kein Preis"
                      inputClassName="text-base font-semibold"
                    />
                  </div>
                </div>
              </div>
              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusClass(listing, isProcessing)}`}>
                {getStatusLabel(listing, isProcessing)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Views</div>
            <div className="mt-1 font-semibold">{formatViews(listing.view_count)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">{"❤️"} Gemerkt</div>
            <div className="mt-1 font-semibold">{listing.bookmark_count ?? 0}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Konto</div>
            <div className="mt-1 font-semibold">{listing.accountLabel || "-"}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Letzter Sync</div>
            <div className="mt-1 text-sm">{formatDate(listing.last_scraped_at)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Lauft ab</div>
            <div className="mt-1 text-sm">{formatDate(listing.expires_at)}</div>
          </div>
        </div>

        <AutoBumpSection listing={listing} onUpdated={onListingUpdated} />

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-xs font-semibold text-slate-500 mb-1">{"📊"} Views & Bookmarks über Zeit</div>
          <ListingStatsChart listing={listing} />
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Beschreibung</div>
          <div className="mt-2 text-sm text-slate-700">
            <InlineEditField
              value={listing.description || ""}
              onSave={saveDescription}
              placeholder="Keine Beschreibung."
              multiline
            />
          </div>
        </div>

        {listing.url ? (
          <a href={listing.url} target="_blank" rel="noreferrer" className="block break-all rounded-lg border border-slate-200 p-3 text-sm text-blue-600 underline">
            {listing.url}
          </a>
        ) : null}
      </div>
    </Modal>
  );
}
