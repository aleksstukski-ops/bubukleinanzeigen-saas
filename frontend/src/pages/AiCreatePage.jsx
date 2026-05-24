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

export default function AiCreatePage() {
  const [loaded, setLoaded] = useState(false);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imageName, setImageName] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
  });

  if (!loaded) {
    setLoaded(true);
  }

  const applyResponseFields = (data) => {
    setForm((current) => ({
      title: data?.title ?? current.title,
      description: data?.description ?? current.description,
      price: data?.price ?? current.price,
      category: data?.category ?? data?.category_id ?? current.category,
    }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImageName(file.name);
    setImagePreview(URL.createObjectURL(file));
    setPageError("");
    setPageNotice("");
  };

  const buildFormData = (mode) => {
    const data = new FormData();
    if (imageFile) {
      data.append("image", imageFile);
    }
    data.append("title", form.title || "");
    data.append("description", form.description || "");
    data.append("price", form.price || "");
    data.append("category", form.category || "");
    data.append("mode", mode);
    return data;
  };

  const handleLoadSuggestion = async () => {
    if (!imageFile) {
      setPageError("Bitte zuerst ein Bild auswählen.");
      return;
    }

    setLoadingSuggestion(true);
    setPageError("");
    setPageNotice("");
    try {
      const response = await api.post("/listings/ai-create", buildFormData("preview"), {
        headers: { "Content-Type": "multipart/form-data" },
      });
      applyResponseFields(response.data || {});
      setPageNotice("KI-Vorschlag geladen. Felder können jetzt bearbeitet werden.");
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const handlePublish = async () => {
    if (!imageFile) {
      setPageError("Bitte zuerst ein Bild auswählen.");
      return;
    }

    if (!form.title.trim() || !form.description.trim()) {
      setPageError("Bitte Titel und Beschreibung ausfüllen.");
      return;
    }

    setPublishing(true);
    setPageError("");
    setPageNotice("");
    try {
      const response = await api.post("/listings/ai-create", buildFormData("publish"), {
        headers: { "Content-Type": "multipart/form-data" },
      });
      applyResponseFields(response.data || {});
      setPageNotice(response?.data?.message || "KI-Inserat zur Veröffentlichung übergeben.");
    } catch (error) {
      setPageError(getErrorMessage(error));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 md:px-6" style={surfaceStyle}>
      <div className="mx-auto max-w-4xl space-y-4">
        <section className="rounded-2xl p-5 shadow-sm" style={cardStyle}>
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">{'✨'} KI-Inserat erstellen</h1>
              <p className="mt-2 text-sm opacity-70">
                Bild hochladen, KI-Vorschlag laden und die vorausgefüllten Felder vor dem Veröffentlichen anpassen.
              </p>
            </div>
            <button
              type="button"
              onClick={handleLoadSuggestion}
              disabled={loadingSuggestion}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              {loadingSuggestion ? "Analysiert..." : "KI-Vorschlag laden"}
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
          <h2 className="text-lg font-semibold">{'🖼️'} Bild</h2>
          <div className="mt-4 space-y-4">
            <label
              htmlFor="ai-image-upload"
              className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 px-4 py-6 text-center"
              style={inputStyle}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Vorschau"
                  className="max-h-48 rounded-xl object-contain"
                />
              ) : (
                <div className="space-y-2">
                  <div className="text-3xl">{'📷'}</div>
                  <div className="text-sm font-medium">Produktbild auswählen</div>
                  <div className="text-xs opacity-70">PNG, JPG oder WEBP</div>
                </div>
              )}
              <input
                id="ai-image-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
            <div className="text-sm opacity-70">
              {imageName ? `Ausgewählt: ${imageName}` : "Noch kein Bild ausgewählt"}
            </div>
          </div>
        </section>

        <section className="rounded-2xl p-5 shadow-sm" style={cardStyle}>
          <h2 className="text-lg font-semibold">{'📝'} Inserat-Daten</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Titel</label>
              <input
                type="text"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="KI-Titel erscheint hier"
                className="w-full rounded-xl px-3 py-3 text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Beschreibung</label>
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="KI-Beschreibung erscheint hier"
                rows={7}
                className="w-full rounded-xl px-3 py-3 text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Preis</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                  placeholder="0"
                  className="w-full rounded-xl px-3 py-3 text-sm outline-none"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Kategorie</label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  placeholder="Kategorie"
                  className="w-full rounded-xl px-3 py-3 text-sm outline-none"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl p-5 shadow-sm" style={cardStyle}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleLoadSuggestion}
              disabled={loadingSuggestion}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold"
              style={inputStyle}
            >
              {loadingSuggestion ? "Analysiert..." : "KI-Vorschlag laden"}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
            >
              {publishing ? "Veröffentlicht..." : "Veröffentlichen"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
