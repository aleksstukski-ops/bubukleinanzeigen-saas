export default function AgbPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>
        Allgemeine Geschäftsbedingungen (AGB)
      </h1>

      <section className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>§ 1 Geltungsbereich</h2>
        <p>
          Diese AGB gelten für alle Leistungen von [Anbieter] (nachfolgend „Anbieter") gegenüber
          Nutzern der Plattform BubuKleinanzeigen.
        </p>
      </section>

      <section className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>§ 2 Leistungsbeschreibung</h2>
        <p>
          BubuKleinanzeigen ist ein SaaS-Dienst zur Verwaltung mehrerer Kleinanzeigen.de-Konten.
          Der Dienst stellt Funktionen zur Übersicht, Verwaltung und Benachrichtigung bereit.
        </p>
      </section>

      <section className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>§ 3 Vertragsschluss</h2>
        <p>
          Der Vertrag kommt durch die Registrierung und Bestätigung der E-Mail-Adresse zustande.
          Mit der Registrierung akzeptiert der Nutzer diese AGB.
        </p>
      </section>

      <section className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>§ 4 Preise und Zahlung</h2>
        <p>
          Die aktuellen Preise sind auf der Abrechnungsseite einsehbar. Zahlungen werden
          monatlich im Voraus via Stripe abgewickelt. Preisänderungen werden mit einer Frist
          von 30 Tagen angekündigt.
        </p>
      </section>

      <section className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>§ 5 Pflichten des Nutzers</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Der Nutzer ist verantwortlich für die Einhaltung der Nutzungsbedingungen von Kleinanzeigen.de.</li>
          <li>Der Nutzer darf den Dienst nicht für automatisierten Massenmissbrauch nutzen.</li>
          <li>Zugangsdaten sind vertraulich zu behandeln.</li>
        </ul>
      </section>

      <section className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>§ 6 Haftungsbeschränkung</h2>
        <p>
          Der Anbieter haftet nicht für Schäden, die durch Änderungen der Kleinanzeigen.de-Plattform,
          Kontosperrungen durch Kleinanzeigen.de oder Datenverluste durch höhere Gewalt entstehen.
        </p>
      </section>

      <section className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>§ 7 Kündigung</h2>
        <p>
          Abonnements können jederzeit zum Ende des aktuellen Abrechnungszeitraums gekündigt werden.
          Eine Kündigung ist über die Abrechnungsseite oder per E-Mail möglich.
        </p>
      </section>

      <section className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>§ 8 Anwendbares Recht</h2>
        <p>Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts.</p>
      </section>

      <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
        Bitte lass diese AGB durch einen Anwalt prüfen und ersetze die Platzhalter
        durch deine echten Angaben vor dem Launch.
      </p>
    </div>
  );
}
