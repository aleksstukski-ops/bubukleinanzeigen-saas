import Modal from "./Modal";

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
}) {
  if (!listing) return null;

  const footer = (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={onEdit} disabled={isProcessing || deleting} className="btn-secondary">Bearbeiten</button>
      <button type="button" onClick={onBump} disabled={isProcessing || bumping || deleting} className="btn-primary">
        {bumping ? "Wird gestartet..." : "Hochschieben"}
      </button>
      <button type="button" onClick={onDelete} disabled={deleting} className="btn-danger">
        {deleting ? "Löscht..." : "Löschen"}
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
                <div className="mt-2 text-base font-semibold">{"💰"} {listing.price || "Kein Preis"}</div>
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
            <div className="text-xs text-slate-500">Konto</div>
            <div className="mt-1 font-semibold">{listing.accountLabel || "-"}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Letzter Sync</div>
            <div className="mt-1 text-sm">{formatDate(listing.last_scraped_at)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Läuft ab</div>
            <div className="mt-1 text-sm">{formatDate(listing.expires_at)}</div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Beschreibung</div>
          <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{listing.description || "Keine Beschreibung."}</div>
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
