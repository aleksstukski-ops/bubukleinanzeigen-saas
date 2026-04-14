# Agent Start Prompt

Kopiere den folgenden Text komplett in ChatGPT (oder Claude) wenn du eine neue Session starten willst. Passe nur die markierte `[SESSION X]` Stelle an.

---

## Der Prompt

```
Du übernimmst ein laufendes SaaS-Projekt: BubuKleinanzeigen.

REPO: https://github.com/USERNAME/bubukleinanzeigen-saas
(ersetze USERNAME mit dem echten Username, oder gib die Raw-Links)

DEIN ERSTER SCHRITT:
1. Lies HANDOFF.md komplett (Architektur, Regeln, Session-Plan)
2. Lies PROJECT_STATE.md (was zuletzt gemacht wurde, was als nächstes dran ist)
3. Schau dir den bestehenden Code an, besonders:
   - backend/app/models/ (Datenmodell)
   - backend/app/api/routers/ (bestehende Endpoints)
   - backend/app/scraper/ (Scraper-Skelett)
4. Erst DANN fang an zu coden

DEINE AUFGABE DIESE SESSION:
[SESSION X] — siehe Session-Plan in HANDOFF.md Abschnitt 6

REGELN (strikt, aus HANDOFF.md):
- Deutsch im Chat, Englisch in Code-Kommentaren, Deutsch in UI-Texten
- Direkte, knappe Antworten. Actions > Words
- Kein useEffect → if (!loaded) { setLoaded(true); load() } Pattern
- Kein React StrictMode
- Keine lucide-react → Emojis als Strings: {'📋'}
- axios 0.27.2 pinned
- React 18, nicht 19
- Mobile-first, iOS Safari Kompatibilität Pflicht
- Panel-Slides via translate3d Transform, nicht conditional render
- Listen: stabile IDs als key, nie Index
- Hab eine Meinung, widersprich wenn was architektonisch falsch ist

DEIN LETZTER SCHRITT:
- PROJECT_STATE.md aktualisieren (was gemacht, was offen, welche Entscheidungen)
- Bei architektonischen Entscheidungen: docs/DECISIONS.md dokumentieren
- Git-Commits mit klaren Messages (Englisch, Imperativ, prefix feat/fix/chore/docs)

Leg los. Frag nicht erst um Erlaubnis, mach. Erklär hinterher.
```

---

## Session-spezifische Zusätze

Je nach Session kannst du am Ende noch hinzufügen:

### Session 1 Teil 3 (Frontend-Skelett)

```
FOKUS DIESER SESSION:
Frontend-Gerüst fertigstellen. Akzeptanzkriterium:
- docker compose up startet alles
- User kann sich auf /register anmelden → automatischer Login
- Dashboard zeigt "0 verbundene Konten"
- User kann "Konto hinzufügen" mit Label → erscheint in Liste
- Plan-Limit (Free=1) wird im UI respektiert
- Mobile (iPhone-Viewport) funktioniert sauber

Baue alle in HANDOFF.md Abschnitt 6 unter "Session 1 Teil 3" gelisteten Dateien.
```

### Session 2 (Scraper)

```
FOKUS DIESER SESSION:
Echtes Kleinanzeigen-Scraping aktivieren. Akzeptanzkriterium:
- User kann über UI "Kleinanzeigen-Login starten" klicken
- Visible Browser öffnet, User loggt sich manuell ein
- Scraper erkennt erfolgreichen Login, speichert verschlüsselte Session
- "Refresh" auf Account triggert SCRAPE_LISTINGS Job
- Nach Job-Completion zeigt UI echte Inserate des Users
- Bei UI-Änderung (Fallback-Selektor) wird WARNING geloggt

Baue selectors.py, pages/base.py, pages/login_page.py, pages/listings_page.py,
implementiere VERIFY_SESSION und SCRAPE_LISTINGS Handler in dispatcher.py.
```

### Session 3 und später

Analog. Schau in `HANDOFF.md` Abschnitt 6 für Akzeptanzkriterien pro Session.

---

## Was tun wenn der Agent sich verrennt?

**Symptom: Agent will eine der Code-Regeln verletzen (z.B. lucide-react einbauen)**
Reaktion: "Stopp. HANDOFF.md Abschnitt 2 lesen. Regel wird nicht gebrochen. Neu machen."

**Symptom: Agent baut was Großes was nicht im Plan steht**
Reaktion: "Das ist nicht Session X. Focus zurück auf die Aufgabe. Feature-Ideen in docs/IDEAS.md dokumentieren, aber nicht einbauen."

**Symptom: Agent schlägt vor, die Tech-Stack-Wahl zu ändern**
Reaktion: "Tech-Stack ist fixiert in HANDOFF.md. Nur diskutieren wenn du einen schwerwiegenden Grund hast, dann in docs/DECISIONS.md dokumentieren und den Chef fragen."

**Symptom: Agent fragt 20 Rückfragen statt anzufangen**
Reaktion: "Beste Interpretation wählen, anfangen, Annahmen am Ende dokumentieren. Nicht blockieren."

**Symptom: Irgendwas scheint architektonisch fishy**
Reaktion: Mach Screenshot/Kopie der Situation, geh zurück zu Claude Opus 4.6 für einen Review. Das ist legitim — Multi-Agent-Workflow heißt auch zweite Meinung holen.
