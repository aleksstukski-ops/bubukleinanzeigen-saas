import { useMemo, useState } from "react";
import api from "../lib/api";
import ListingDetailModal from "../components/ListingDetailModal";
import ListingEditModal from "../components/ListingEditModal";

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

function formatViews(value) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("de-DE").format(Number(value));
}

function getSortValue(listing, sortBy) {
  if (sortBy === "price_asc") {
    const numericPrice = Number(String(listing.price || "").replace(/[^\d,.-]/g, "").replace(",", "."));
    return Number.isFinite(numericPrice) ? numericPrice : Number.MAX_SAFE_INTEGER;
  }
  if (sortBy === "views_desc") {
    return Number(listing.view_count || 0) * -1;
  }
  return Number(listing.kleinanzeigen_id || 0) * -1;
}

function getStatusLabel(listing, processingState) {
  if (processingState) return "Wird verarbeitet";
  if (listing.is_active) return "Aktiv";
  return "Inaktiv";
}

function getStatusClass(listing, processingState) {
  if (processingState) return "border border-amber-200 bg-amber-100 text-amber-800";
  if (listing.is_active) return "border border-emerald-200 bg-emerald-100 text-emerald-700";
  return "border border-slate-200 bg-slate-100 text-slate-700";
}

export default function ListingsPage() {
  const [loaded, setLoaded] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedListing, setSelectedListing] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [activeActionId, setActiveActionId] = useState("");
  const [processingById, setProcessingById] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const loadListings = async () => {
    setLoading(true);
    setPageError("");
    try {
      // Single call for all accounts — avoids N+1 round trips
      const [accountsResponse, allListingsResponse] = await Promise.all([
        api.get("/ka-accounts"),
        api.get("/listings/all"),
      ]);

      const accountItems = accountsResponse.data || [];
      setAccounts(accountItems);

      const accountLabelById = new Map(accountItems.map((a) => [a.id, a.label]));
      const allListings = (allListingsResponse.data || []).map((listing) => ({
        ...listing,
        accountLabel: accountLabelById.get(listing.account_id) || `Konto ${listing.account_id}`,
      }));
      setListings(allListings);
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (!loaded) {
    setLoaded(true);
    loadListings();
  }

  const filteredListings = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return [...listings]
      .filter((listing) => {
        if (selectedAccountId !== "all" && String(listing.account_id) !== selectedAccountId) return false;
        if (!normalizedSearch) return true;
        return String(listing.title || "").toLowerCase().includes(normalizedSearch);
      })
      .sort((left, right) => {
        const leftValue = getSortValue(left, sortBy);
        const rightValue = getSortValue(right, sortBy);
        if (leftValue < rightValue) return -1;
        if (leftValue > rightValue) return 1;
        return String(left.kleinanzeigen_id).localeCompare(String(right.kleinanzeigen_id));
      });
  }, [listings, searchTerm, selectedAccountId, sortBy]);

  const stats = useMemo(() => ({
    total: filteredListings.length,
    active: filteredListings.filter((l) => l.is_active).length,
    views: filteredListings.reduce((sum, l) => sum + Number(l.view_count || 0), 0),
  }), [filteredListings]);

  const openListing = (listing) => {
    setSelectedListing(listing);
    setEditOpen(false);
    setEditError("");
  };

  const closeDetailModal = () => {
    setSelectedListing(null);
    setEditOpen(false);
    setEditError("");
  };

  const markProcessing = (listingId, type) => {
    setProcessingById((current) => ({ ...current, [listingId]: type }));
  };

  const handleBump = async () => {
    if (!selectedListing) return;
    const listingId = selectedListing.kleinanzeigen_id;
    setActiveActionId(`bump:${listingId}`);
    setPageError("");
    setPageNotice("");
    try {
      await api.post(`/listings/${listingId}/bump`, { account_id: selectedListing.account_id });
      markProcessing(listingId, "bump");
      setPageNotice("Hochschieben wurde gestartet.");
      await loadListings();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setActiveActionId("");
    }
  };

  const handleDelete = async () => {
    if (!selectedListing) return;
    const confirmed = window.confirm(`Inserat "${selectedListing.title}" wirklich löschen?`);
    if (!confirmed) return;
    const listingId = selectedListing.kleinanzeigen_id;
    setActiveActionId(`delete:${listingId}`);
    setPageError("");
    setPageNotice("");
    try {
      await api.delete(`/listings/${listingId}`, { data: { account_id: selectedListing.account_id } });
      markProcessing(listingId, "delete");
      setPageNotice("Löschen wurde gestartet.");
      closeDetailModal();
      await loadListings();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setActiveActionId("");
    }
  };

  const handleEditSubmit = async (payload) => {
    if (!selectedListing) return;
    const listingId = selectedListing.kleinanzeigen_id;
    setSavingEdit(true);
    setEditError("");
    setPageError("");
    setPageNotice("");
    try {
      await api.patch(`/listings/${listingId}`, { account_id: selectedListing.account_id, ...payload });
      markProcessing(listingId, "update");
      setPageNotice("Bearbeitung wurde gestartet.");
      setEditOpen(false);
      await loadListings();
    } catch (error) {
      setEditError(getErrorMessage(error));
    } finally {
      setSavingEdit(false);
    }
  };

  const selectedProcessingState = selectedListing ? processingById[selectedListing.kleinanzeigen_id] : "";

  const toggleSelectId = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredListings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredListings.map((l) => l.kleinanzeigen_id)));
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    setPageError("");
    setPageNotice("");
    try {
      const res = await api.post("/listings/bulk-action", {
        listing_ids: [...selectedIds],
        action,
      });
      setPageNotice(`${res.data.length} Job(s) gestartet.`);
      setSelectedIds(new Set());
      await loadListings();
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <section className="card">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Inserate</h1>
              <p className="mt-2 text-sm text-slate-500">Alle Inserate aus deinen aktiven Konten in einer Übersicht.</p>
            </div>
            <button type="button" onClick={loadListings} disabled={loading} className="btn-secondary">
              {loading ? "Lädt..." : "Neu laden"}
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Gefiltert</div>
              <div className="mt-2 text-2xl font-semibold">{loading ? "..." : stats.total}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Aktiv</div>
              <div className="mt-2 text-2xl font-semibold">{loading ? "..." : stats.active}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Views gesamt</div>
              <div className="mt-2 text-2xl font-semibold">{loading ? "..." : formatViews(stats.views)}</div>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="grid gap-3 lg:grid-cols-3">
            <div>
              <label className="label">Konto</label>
              <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="input">
                <option value="all">Alle Konten</option>
                {accounts.map((account) => (
                  <option key={account.id} value={String(account.id)}>{account.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Suche</label>
              <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Nach Titel suchen" className="input" />
            </div>
            <div>
              <label className="label">Sortierung</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input">
                <option value="newest">Neueste zuerst</option>
                <option value="price_asc">Preis aufsteigend</option>
                <option value="views_desc">Views absteigend</option>
              </select>
            </div>
          </div>

          {pageError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{pageError}</div> : null}
          {pageNotice ? <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">{pageNotice}</div> : null}

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <span className="text-sm font-medium text-blue-700">{selectedIds.size} ausgewahlt</span>
              <button
                type="button"
                className="btn-primary py-1 px-3 text-sm"
                disabled={bulkLoading}
                onClick={() => handleBulkAction("bump")}
              >
                {bulkLoading ? "..." : "Alle hochschieben"}
              </button>
              <button
                type="button"
                className="btn-danger py-1 px-3 text-sm"
                disabled={bulkLoading}
                onClick={() => handleBulkAction("delete")}
              >
                {bulkLoading ? "..." : "Alle loschen"}
              </button>
              <button
                type="button"
                className="ml-auto text-sm text-blue-600 hover:text-blue-800"
                onClick={() => setSelectedIds(new Set())}
              >
                Abwahlen
              </button>
            </div>
          )}

          {loading ? (
            <div className="mt-4 grid gap-3">
              <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-28 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : null}

          {!loading && filteredListings.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
              <div className="text-base font-medium">Keine Inserate gefunden</div>
              <p className="mt-2 text-sm text-slate-500">Prüfe Filter oder starte einen Refresh über deine Konten.</p>
            </div>
          ) : null}

          {!loading && filteredListings.length > 0 ? (
            <div className="mt-4">
              {/* Select all row */}
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredListings.length && filteredListings.length > 0}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-xs text-slate-500">Alle ausw{"\u00e4"}hlen</span>
              </div>
              <div className="grid gap-3">
              {filteredListings.map((listing) => {
                const processingState = processingById[listing.kleinanzeigen_id];
                const isSelected = selectedIds.has(listing.kleinanzeigen_id);
                return (
                  <div
                    key={listing.kleinanzeigen_id}
                    className={`flex items-start gap-3 rounded-lg border p-4 transition ${isSelected ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm"}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => { e.stopPropagation(); toggleSelectId(listing.kleinanzeigen_id); }}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => openListing(listing)}
                    >
                    <div className="flex gap-4">
                      <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        {listing.image_url ? (
                          <img src={listing.image_url} alt={listing.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-3xl">{"📷"}</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs text-slate-500">{"📋"} {listing.accountLabel || `Konto ${listing.account_id}`}</div>
                            <h3 className="mt-1 truncate text-base font-semibold text-slate-900">{listing.title}</h3>
                          </div>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClass(listing, processingState)}`}>
                            {getStatusLabel(listing, processingState)}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                          <div>{"💰"} {listing.price || "Kein Preis"}</div>
                          <div>Views: {formatViews(listing.view_count)}</div>
                          <div>{"❤️"} {listing.bookmark_count || 0}</div>
                          <div>Sync: {formatDate(listing.last_scraped_at)}</div>
                        </div>
                      </div>
                    </div>
                    </button>
                  </div>
                );
              })}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <ListingDetailModal
        open={Boolean(selectedListing) && !editOpen}
        listing={selectedListing}
        isProcessing={Boolean(selectedProcessingState)}
        bumping={Boolean(selectedListing) && activeActionId === `bump:${selectedListing?.kleinanzeigen_id}`}
        deleting={Boolean(selectedListing) && activeActionId === `delete:${selectedListing?.kleinanzeigen_id}`}
        onClose={closeDetailModal}
        onEdit={() => { setEditError(""); setEditOpen(true); }}
        onBump={handleBump}
        onDelete={handleDelete}
        onListingUpdated={(updated) => {
          setListings((prev) => prev.map((l) => l.kleinanzeigen_id === updated.kleinanzeigen_id ? { ...l, ...updated, accountLabel: l.accountLabel } : l));
          setSelectedListing((prev) => prev ? { ...prev, ...updated, accountLabel: prev.accountLabel } : prev);
        }}
      />

      <ListingEditModal
        open={Boolean(selectedListing) && editOpen}
        listing={selectedListing}
        saving={savingEdit}
        error={editError}
        onClose={() => { setEditOpen(false); setEditError(""); }}
        onSubmit={handleEditSubmit}
      />
    </>
  );
}
