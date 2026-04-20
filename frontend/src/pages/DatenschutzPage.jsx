export default function DatenschutzPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold" style={{ color: "var(--text)" }}>Datenschutzerklärung</h1>

      <section className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>1. Verantwortlicher</h2>
        <p>
          Verantwortlich im Sinne der DSGVO ist: [Vorname Nachname / Firma], [Adresse], [E-Mail].
        </p>
      </section>

      <section className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>2. Verarbeitete Daten</h2>
        <p>
          Wir verarbeiten folgende personenbezogenen Daten:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>E-Mail-Adresse und Passwort (verschlüsselt) für die Kontoerstellung</li>
          <li>Verschlüsselte Sitzungsdaten für verbundene Kleinanzeigen-Konten</li>
          <li>Zahlungsdaten (werden direkt an Stripe übertragen, nicht bei uns gespeichert)</li>
          <li>Server-Logdaten (IP-Adresse, Zeitstempel, aufgerufene Ressourcen)</li>
        </ul>
      </section>

      <section className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>3. Rechtsgrundlagen</h2>
        <p>
          Die Verarbeitung erfolgt auf Basis von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)
          sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigte Interessen, z. B. Sicherheit).
        </p>
      </section>

      <section className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>4. Drittanbieter</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Stripe Inc.</strong> (Zahlungsabwicklung) — Datenschutzerklärung:{" "}
            <a href="https://stripe.com/de/privacy" className="underline" target="_blank" rel="noopener noreferrer">
              stripe.com/de/privacy
            </a>
          </li>
        </ul>
      </section>

      <section className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>5. Cookies</h2>
        <p>
          Wir verwenden ausschließlich technisch notwendige Cookies (JWT-Token im
          localStorage). Es werden keine Tracking- oder Werbe-Cookies eingesetzt.
        </p>
      </section>

      <section className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>6. Deine Rechte</h2>
        <p>
          Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der
          Verarbeitung sowie Datenübertragbarkeit. Wende dich dazu an: [kontakt@example.com].
        </p>
        <p>
          Du hast außerdem das Recht, eine Beschwerde bei der zuständigen
          Datenschutzaufsichtsbehörde einzulegen.
        </p>
      </section>

      <section className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        <h2 className="text-base font-semibold" style={{ color: "var(--text)" }}>7. Datenlöschung</h2>
        <p>
          Personenbezogene Daten werden gelöscht, sobald der Zweck der Verarbeitung
          entfällt und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
        </p>
      </section>

      <p className="text-xs" style={{ color: "var(--text-subtle)" }}>
        Bitte lass diese Erklärung durch einen Anwalt prüfen und ersetze die Platzhalter
        durch deine echten Angaben vor dem Launch.
      </p>
    </div>
  );
}
