import { useState } from "react";
import api from "../lib/api";

function parseCSV(text) {
  // Detect delimiter: semicolon, tab, or comma
  var firstLine = text.split("\n")[0] || "";
  var delim = ",";
  if (firstLine.indexOf(";") > -1) delim = ";";
  else if (firstLine.indexOf("\t") > -1) delim = "\t";

  var lines = text.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };

  var headers = lines[0].split(delim).map(function (h) { return h.trim().toLowerCase(); });
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var cols = lines[i].split(delim).map(function (c) { return c.trim(); });
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = cols[j] || "";
    }
    if (row.title) rows.push(row);
  }
  return { headers: headers, rows: rows };
}

export default function ImportPage() {
  var [accounts, setAccounts] = useState([]);
  var [loaded, setLoaded] = useState(false);
  var [selectedAccountId, setSelectedAccountId] = useState("");
  var [fileContent, setFileContent] = useState(null);
  var [parsed, setParsed] = useState(null);
  var [fileName, setFileName] = useState("");
  var [importing, setImporting] = useState(false);
  var [progress, setProgress] = useState(0);
  var [result, setResult] = useState(null);
  var [error, setError] = useState("");

  var loadAccounts = async function () {
    try {
      var res = await api.get("/ka-accounts");
      setAccounts(res.data || []);
      if (res.data && res.data.length === 1) {
        setSelectedAccountId(String(res.data[0].id));
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Konten konnten nicht geladen werden.");
    }
  };

  if (!loaded) {
    setLoaded(true);
    loadAccounts();
  }

  var handleFileChange = function (e) {
    setError("");
    setResult(null);
    setParsed(null);
    setFileContent(null);
    setFileName("");
    setProgress(0);

    var file = e.target.files && e.target.files[0];
    if (!file) return;

    if (file.size > 1000000) {
      setError("Datei zu gross (max. 1 MB).");
      return;
    }

    setFileName(file.name);

    var reader = new FileReader();
    reader.onload = function (evt) {
      var text = evt.target.result;
      setFileContent(text);
      var data = parseCSV(text);
      if (data.rows.length === 0) {
        setError("Keine verwertbaren Zeilen gefunden. Spalte 'title' ist Pflicht.");
        return;
      }
      if (data.rows.length > 30) {
        setError("Maximal 30 Zeilen pro Import. Bitte CSV aufteilen.");
        return;
      }
      setParsed(data);
    };
    reader.readAsText(file, "utf-8");
  };

  var handleImport = async function () {
    if (!selectedAccountId) {
      setError("Bitte waehle ein Konto aus.");
      return;
    }
    if (!fileContent) {
      setError("Bitte waehle eine CSV-Datei aus.");
      return;
    }

    setImporting(true);
    setError("");
    setResult(null);
    setProgress(10);

    try {
      var blob = new Blob([fileContent], { type: "text/csv" });
      var formData = new FormData();
      formData.append("account_id", selectedAccountId);
      formData.append("file", blob, fileName || "import.csv");

      setProgress(30);

      var res = await api.post("/listings/import-csv", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setProgress(100);
      setResult({
        count: (res.data || []).length,
        jobs: res.data || [],
      });
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || "Import fehlgeschlagen.");
      setProgress(0);
    } finally {
      setImporting(false);
    }
  };

  var handleReset = function () {
    setFileContent(null);
    setParsed(null);
    setFileName("");
    setProgress(0);
    setResult(null);
    setError("");
  };

  var visibleHeaders = parsed
    ? parsed.headers.filter(function (h) { return ["title", "description", "price", "category_id", "location"].indexOf(h) > -1; })
    : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-6 text-xl font-bold text-slate-900">{'📥'} CSV Import</h1>

      {/* Account selector */}
      <div className="mb-6">
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="import-account">
          Ziel-Konto
        </label>
        <select
          id="import-account"
          value={selectedAccountId}
          onChange={function (e) { setSelectedAccountId(e.target.value); }}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="">Konto waehlen...</option>
          {accounts.map(function (a) {
            return (
              <option key={a.id} value={String(a.id)}>{a.label || "Konto " + a.id}</option>
            );
          })}
        </select>
      </div>

      {/* File upload */}
      {!result && (
        <div className="mb-6">
          <label
            htmlFor="csv-file"
            className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 transition hover:border-blue-400 hover:bg-blue-50"
          >
            <span className="text-3xl">{'📄'}</span>
            <span className="mt-2 text-sm font-medium text-slate-600">
              {fileName ? fileName : "CSV-Datei hierher ziehen oder klicken"}
            </span>
            <span className="mt-1 text-xs text-slate-400">
              Pflicht-Spalte: title. Optional: description, price, category_id, location
            </span>
            <input
              id="csv-file"
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Preview table */}
      {parsed && !result && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Vorschau — {parsed.rows.length} Inserat{parsed.rows.length !== 1 ? "e" : ""}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-2 text-center">#</th>
                  {visibleHeaders.map(function (h) {
                    return <th key={h} className="px-4 py-2">{h}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {parsed.rows.map(function (row, idx) {
                  return (
                    <tr key={"row-" + idx} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2 text-center text-xs text-slate-400">{idx + 1}</td>
                      {visibleHeaders.map(function (h) {
                        var val = row[h] || "";
                        var display = val.length > 60 ? val.slice(0, 60) + "..." : val;
                        return (
                          <td key={h} className="max-w-[200px] truncate px-4 py-2 text-slate-700">{display}</td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {importing && (
        <div className="mb-6">
          <div className="mb-2 text-sm font-medium text-slate-600">Import laeuft...</div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: progress + "%" }}
            />
          </div>
          <div className="mt-1 text-xs text-slate-400">{progress}%</div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="text-center">
            <div className="text-3xl">{'✅'}</div>
            <p className="mt-2 text-base font-semibold text-emerald-800">
              {result.count} Inserat{result.count !== 1 ? "e" : ""} importiert
            </p>
            <p className="mt-1 text-sm text-emerald-600">
              Die Inserate werden jetzt im Hintergrund auf Kleinanzeigen.de erstellt.
              Du kannst den Fortschritt unter Inserate verfolgen.
            </p>
          </div>
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Weiteren Import starten
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {parsed && !result && !importing && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleImport}
            disabled={!selectedAccountId}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {'🚀'} {parsed.rows.length} Inserat{parsed.rows.length !== 1 ? "e" : ""} importieren
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Abbrechen
          </button>
        </div>
      )}

      {/* Help */}
      <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-700">{'💡'} CSV-Format Hilfe</h3>
        <p className="mt-2 text-xs text-slate-500">
          Erstelle eine CSV-Datei mit folgenden Spalten. Nur <strong>title</strong> ist Pflicht.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-400">
                <th className="px-3 py-2">title</th>
                <th className="px-3 py-2">price</th>
                <th className="px-3 py-2">description</th>
                <th className="px-3 py-2">location</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-slate-600">
                <td className="px-3 py-2">iPhone 14 Pro</td>
                <td className="px-3 py-2">750</td>
                <td className="px-3 py-2">Wie neu, mit OVP</td>
                <td className="px-3 py-2">Berlin</td>
              </tr>
              <tr className="text-slate-600">
                <td className="px-3 py-2">IKEA Kallax</td>
                <td className="px-3 py-2">45</td>
                <td className="px-3 py-2">Weiss, guter Zustand</td>
                <td className="px-3 py-2">Hamburg</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Trennzeichen: Komma, Semikolon oder Tab. Max. 30 Zeilen pro Import. Max. 1 MB.
        </p>
      </div>
    </div>
  );
}
