import { useState } from "react";
import Modal from "./Modal";

function getInitialFormState(listing) {
  return {
    title: listing?.title || "",
    price: listing?.price || "",
    description: listing?.description || "",
  };
}

export default function ListingEditModal({
  open,
  listing,
  saving = false,
  error = "",
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(getInitialFormState(listing));
  const [listingKey, setListingKey] = useState(listing?.kleinanzeigen_id);

  if (open && listing?.kleinanzeigen_id !== listingKey) {
    setListingKey(listing?.kleinanzeigen_id);
    setForm(getInitialFormState(listing));
  }

  const handleChange = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit({
      title: form.title.trim(),
      price: form.price.trim(),
      description: form.description.trim(),
    });
  };

  const footer = (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button type="button" className="btn-secondary" onClick={onClose}>Abbrechen</button>
      <button
        type="submit"
        form="listing-edit-form"
        disabled={saving}
        className="btn-primary"
      >
        {saving ? "Speichert..." : "Änderungen speichern"}
      </button>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={listing?.title || "Kein Titel"}
      description={`Konto-ID: ${listing?.account_id || "-"} - Inserat-ID: ${listing?.kleinanzeigen_id || "-"}`}
      footer={footer}
    >
      <form id="listing-edit-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Titel</label>
          <input
            type="text"
            value={form.title}
            onChange={(event) => handleChange("title", event.target.value)}
            maxLength={500}
            required
            className="input"
          />
        </div>

        <div>
          <label className="label">Preis</label>
          <input
            type="text"
            value={form.price}
            onChange={(event) => handleChange("price", event.target.value)}
            maxLength={64}
            className="input"
          />
        </div>

        <div>
          <label className="label">Beschreibung</label>
          <textarea
            value={form.description}
            onChange={(event) => handleChange("description", event.target.value)}
            rows={8}
            maxLength={10000}
            className="input"
          />
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
