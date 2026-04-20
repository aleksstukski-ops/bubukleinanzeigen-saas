export default function ImpressumPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>Impressum</h1>

      <section className="space-y-1 text-sm" style={{ color: "var(--text-muted)" }}>
        <p className="font-medium" style={{ color: "var(--text)" }}>Angaben gemäß § 5 TMG</p>
        <p>[Vorname Nachname / Firma]</p>
        <p>[Straße Hausnummer]</p>
        <p>[PLZ Ort]</p>
        <p>Deutschland</p>
      </section>

      <section className="space-y-1 text-sm" style={{ color: "var(--text-muted)" }}>
        <p className="font-medium" style={{ color: "var(--text)" }}>Kontakt</p>
        <p>E-Mail: [kontakt@example.com]</p>
      </section>

      <section className="space-y-1 text-sm" style={{ color: "var(--text-muted)" }}>
        <p className="font-medium" style={{ color: "var(--text)" }}>Verantwortlich für den Inhalt (§ 55 Abs. 2 RStV)</p>
        <p>[Vorname Nachname, Anschrift wie oben]</p>
      </section>

      <section className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <p className="font-medium" style={{ color: "var(--text)" }}>Haftungsausschluss</p>
        <p>
          Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit,
          Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
        </p>
      </section>

      <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
        Bitte ersetze die Platzhalter durch deine echten Angaben vor dem Launch.
      </p>
    </div>
  );
}
