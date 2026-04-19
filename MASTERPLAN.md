# BubuKleinanzeigen SaaS — MASTERPLAN

**Erstellt:** 2026-04-19 von Claude Opus 4.6 (Architekt)
**Zweck:** Einzige Quelle der Wahrheit. Jeder Agent liest das ZUERST.

---

## An alle KI-Agenten (Opus, GPT, Kimi, Cursor, wer auch immer)

Du arbeitest an einem laufenden SaaS-Produkt. Es gibt einen menschlichen Chef (Aleks) und mehrere KI-Agenten die zusammenarbeiten. Dieses Dokument ist dein Kompass.

**Lies-Reihenfolge:**
1. Dieses `MASTERPLAN.md` (Gesamtbild, Regeln, Fehler-Katalog)
2. `PROJECT_STATE.md` (was zuletzt gemacht wurde)
3. `HANDOFF.md` (Architektur-Details, Datenmodell, Tech-Stack)
4. Code lesen, dann coden

**Dein letzter Schritt IMMER:**
- `PROJECT_STATE.md` aktualisieren
- Commit mit klarer Message
- Push zu GitHub

---

## 1. Projekt in einem Satz

Multi-Account Kleinanzeigen.de Management als SaaS — Inserate, Nachrichten, Statistiken fuer alle Konten in einer App.

**Domain:** bubuanzeigen.de (LIVE, Cloudflare Tunnel → Mac Mini M4)
**Repo:** github.com/aleksstukski-ops/bubukleinanzeigen-saas (PUBLIC)
**Lokaler Pfad:** /Users/miniagent/Projects/bubukleinanzeigen-saas

---

## 2. Team-Rollen

| Agent | Rolle | Staerken | Einschraenkungen |
|-------|-------|----------|------------------|
| **Claude Opus 4.6** | Architekt, Planer, Reviewer | Architektur, schwierige Bugs, Code-Reviews, Planung | Kein direkter Terminal-Zugriff auf Mac Mini |
| **ChatGPT (GPT-5.4)** | Hauptentwickler | Code schreiben, Features implementieren | Max 3 Dateien pro Nachricht, neigt zu Smart Quotes |
| **Kimi K2.5 (OpenClaw)** | Executor | Terminal-Befehle, Deployment, Health-Checks | Prepaid-API, kann ausfallen |
| **Cursor IDE** | Datei-Editor | Dateien direkt editieren | Abo kann ablaufen |
| **Chef (Aleks)** | Entscheider | Finaler Call, testet im Browser, Mac Mini Zugriff | Will kurze klare Anweisungen, kein Gelaber |

### Kommunikations-Protokoll

Jede Nachricht an den Chef beginnt mit dem Empfaenger:
- `Terminal:` — Chef fuehrt Befehl direkt im Terminal aus
- `ChatGPT:` — Chef kopiert Prompt an ChatGPT
- `Kimi:` — Chef sendet an Kimi/OpenClaw
- `Cursor:` — Chef oeffnet Datei in Cursor IDE

**Stil:** So kurz wie moeglich, so viel wie noetig. Keine Floskeln. Klare Anweisungen. Ergebnis > Erklaerung.

---

## 3. Code-Regeln (NIEMALS VERLETZEN)

### Frontend
- **Kein `useEffect`** → `if (!loaded) { setLoaded(true); load() }` Pattern
- **Kein React StrictMode** — verursacht Double-Mount
- **Keine lucide-react Icons** — nur Emojis als Strings: `{'📋'}`
- **axios 0.27.2** (1.x bricht Vite HMR mit destroy-Fehler)
- **React 18** — keine React 19 Features
- **Mobile-first**, iOS Safari kompatibel
- **Emojis in JSX als Strings** — `'📦'` nicht `📦`

### Backend
- Python 3.11, FastAPI, SQLAlchemy 2 async, PostgreSQL 16, Redis 7
- Async-only — keine synchronen DB-Calls
- Pydantic v2 fuer Schemas
- Alembic fuer Migrationen

### Allgemein
- **ASCII-only Code** — keine Smart Quotes, echte Umlaute statt `\u00fc`
- **Deutsch UI**, Englisch Code-Kommentare
- **Vor Datei-Bearbeitung: IMMER aktuelle Datei lesen** — nie blind editieren
- **Tabs** fuer Python-Indentation, 2 Spaces fuer JS/JSX
- Git Commit-Messages: Englisch, Imperativ, Prefix (`feat:`, `fix:`, `refactor:`, `docs:`)

---

## 4. Fehler-Katalog (LESEN UND VERMEIDEN)

### Fehler 1: Python-Script zerstoert Datei mit `write(None)`
**Was passiert ist:** Ein Python-Inline-Script zum Patchen einer Datei hat `str.replace()` mit einer Bedingung kombiniert. Wenn die Bedingung `False` war, gab `replace()` `None` zurueck, und `open(p, 'w').write(None)` hat die Datei geleert (0 Bytes).
**Lektion:** Niemals Inline-Python-Scripts zum Datei-Patchen verwenden. Stattdessen: `cat > datei << 'EOF'` mit komplettem Dateiinhalt, oder `sed` fuer einfache Ersetzungen.
**Recovery:** `git checkout -- <datei>`

### Fehler 2: sed-Escaping in zsh
**Was passiert ist:** `sed`-Befehle mit komplexen Regex-Patterns und Backslashes haben in zsh nicht korrekt funktioniert weil die Shell Escapes anders interpretiert.
**Lektion:** Bei komplexen Aenderungen lieber die komplette Datei per `cat > datei << 'EOF'` schreiben statt sed.

### Fehler 3: Smart Quotes von GPT
**Was passiert ist:** GPT liefert manchmal typografische Anfuehrungszeichen (`"` `"` statt `"`) die Python/JS nicht als String-Delimiter erkennt.
**Lektion:** Jede GPT-Lieferung vor Einspielen auf Smart Quotes pruefen. Im Terminal: `grep -P '[\x{201C}\x{201D}\x{2018}\x{2019}]' datei.py`

### Fehler 4: FERNET_KEY nicht persistiert
**Was passiert ist:** `crypto.py` hat den Fernet-Key aus `SECRET_KEY` per SHA256 abgeleitet. Jeder Neustart mit anderem `SECRET_KEY` (oder `cli_login.py` mit eigenem Key) hat alle gespeicherten Sessions unbrauchbar gemacht.
**Lektion:** Kryptographie-Keys IMMER als eigene Env-Variable, NIEMALS ableiten. Fix war: `FERNET_KEY` als required field in `.env` + `config.py`.

### Fehler 5: Worker/Scraper Service-Name falsch
**Was passiert ist:** Befehle mit `docker compose up worker` schlugen fehl weil der Service `scraper` heisst, nicht `worker`.
**Lektion:** Immer erst `docker compose ps` pruefen. Die 5 Services sind: `backend`, `frontend`, `postgres`, `redis`, `scraper`.

### Fehler 6: Kimi fuehrt Chat-Text als Terminal-Befehle aus
**Was passiert ist:** Kimi hat Erklaerungstext ("Sobald fertig, melde nur: ...") als Shell-Befehle interpretiert und `zsh: command not found` Fehler produziert.
**Lektion:** An Kimi NUR Terminal-Befehle senden, keinen Erklaerungstext. Alles was kein Befehl ist, in Kommentare (`#`) packen.

### Fehler 7: Bookmark-Selektor existiert nicht im DOM
**Was passiert ist:** GPT hat `AD_BOOKMARK_COUNT` Selektoren erfunden die im echten Kleinanzeigen-DOM nicht existieren. Die Gemerkt-Zahl ("5 mal gemerkt") steht im gleichen Element wie die Besucher-Zahl.
**Lektion:** Selektoren IMMER gegen Live-DOM pruefen bevor sie in Code kommen. Screenshot oder DevTools-Inspect vom Chef anfordern.

---

## 5. Validierungs-Checkliste (VOR JEDEM COMMIT)

- [ ] Datei hat Inhalt (`wc -l datei` > 0)
- [ ] Keine Smart Quotes (`grep -cP '[\x{201C}\x{201D}]' datei` = 0)
- [ ] Python-Syntax OK (`python3 -c "import ast; ast.parse(open('datei').read())"`)
- [ ] Docker-Services starten (`docker compose up -d`, alle healthy)
- [ ] Kein Import-Fehler im Backend (`docker compose logs backend --tail 20`)
- [ ] `PROJECT_STATE.md` aktualisiert

---

## 6. Was FERTIG ist (Stand 2026-04-19)

### Infrastruktur
- [x] Docker Compose (5 Services: backend, frontend, postgres, redis, scraper)
- [x] Cloudflare Tunnel → bubuanzeigen.de LIVE
- [x] GitHub Repo public, alle Agents haben Zugriff
- [x] SMTP (Gmail App-Passwort, Passwort-Reset komplett)

### Auth
- [x] Register, Login, Refresh, Logout
- [x] Passwort vergessen (JWT-basierter Reset-Token + SMTP)
- [x] JWT Access + Refresh Tokens

### Kleinanzeigen-Accounts
- [x] CRUD mit Plan-Limit-Check
- [x] cli_login.py (sichtbarer Browser auf Host, Session-Capture)
- [x] FERNET_KEY Persistenz (f511aa2)
- [x] Session-Encryption/Decryption end-to-end verifiziert

### Scraper
- [x] Selectors mit Fallback-Cascades
- [x] BasePage, LoginPage, ListingsPage, EditListingPage
- [x] MessagesPage, ConversationPage (iframe-Handling)
- [x] Dispatcher mit ALLEN Handlern: START_LOGIN, VERIFY_SESSION, SCRAPE_LISTINGS, SCRAPE_MESSAGES, SCRAPE_CONVERSATION, SEND_MESSAGE, UPDATE_LISTING, DELETE_LISTING, BUMP_LISTING
- [x] bookmark_count Scraping (f66fb6d) — nutzt gleichen Selektor wie view_count, Regex `(\d+)\s*mal gemerkt`

### Frontend
- [x] Dashboard, Konten (Login-Button, Status-Badges)
- [x] Inserate (Filter, Sort, Detail-Modal, Edit-Modal, Views + Bookmark-Count)
- [x] Nachrichten (Inbox, Chat-View, Reply, 30s Polling)
- [x] LoginPage (sauber, ein Passwort-vergessen-Link)

### Scraper-Fixes
- [x] Echte Bilder (srcset-Parsing)
- [x] Preise (Meine-Anzeigen-DOM)
- [x] Views (neuer Selektor)
- [x] Titel ("Anzeige "-Prefix entfernt)
- [x] Reihenfolge (nach kleinanzeigen_id desc)

---

## 7. Roadmap (Was OFFEN ist)

### Phase 1: Stabilisierung (naechste 1-2 Sessions)

| # | Task | Prioritaet | Aufwand | Abhaengigkeit |
|---|------|-----------|---------|---------------|
| 1 | Alembic Migration fuer bookmark_count | HOCH | 15 min | Keine |
| 2 | Session-Auto-Refresh (stilles JWT-Refresh, Banner statt Logout) | HOCH | 3h | Keine |
| 3 | DOM-Haertung (Fallback-Selektoren + Screenshot bei Fehler) | MITTEL | 4h | Keine |
| 4 | Beschreibung scrapen (nur auf Detail-Seite, nicht Uebersicht) | NIEDRIG | 2h | DOM-Haertung |

### Phase 2: Monetarisierung (Session 6)

| # | Task | Aufwand |
|---|------|---------|
| 5 | Stripe-Konto + Produkte anlegen | 1h (Chef) |
| 6 | Backend: Checkout-Session, Webhook, Plan-Gating | 4h |
| 7 | Frontend: Billing-Seite, Upgrade-Button, Stripe Portal | 3h |

**Pricing:**
- Free: 0 EUR, 1 KA-Konto (zum Testen)
- Starter: 9 EUR/Monat, 1 KA-Konto
- Pro: 19 EUR/Monat, 3 KA-Konten
- Business: 39 EUR/Monat, 10 KA-Konten

### Phase 3: Engagement (Session 5 + 7)

| # | Task | Aufwand |
|---|------|---------|
| 8 | Push Notifications (VAPID, Service Worker) | 4h |
| 9 | Admin Dashboard (User-Liste, Scraper-Health, Fehlerraten) | 6h |
| 10 | Telegram/E-Mail Alerts bei Scraper-Fehlern | 2h |

### Phase 4: Production Launch (Session 8)

| # | Task | Aufwand |
|---|------|---------|
| 11 | Production-Deploy (Hetzner oder Mac Mini bleibt) | 4h |
| 12 | Backups (Postgres-Dump taeglich) | 1h |
| 13 | Monitoring (Uptime Kuma) | 1h |
| 14 | Rechtliches (Impressum, DSGVO, AGB, Cookie-Banner) | 2h (Chef + Agent) |
| 15 | Launch-Marketing (Landing Page, Social Media) | Chef |

---

## 8. Architektur-Entscheidungen (ADR)

| ADR | Entscheidung | Datum |
|-----|-------------|-------|
| ADR-006 | Visible Login als Host-CLI-Subprocess (nicht in Docker) | 2026-04-16 |
| ADR-007 | Listing-Actions jobbasiert, kleinanzeigen_id im Payload | 2026-04-16 |
| ADR-008 | FERNET_KEY als eigene Env-Variable, nicht aus SECRET_KEY ableiten | 2026-04-19 |
| ADR-009 | bookmark_count aus gleicher DOM-Section wie view_count, Regex-basiert | 2026-04-19 |

---

## 9. Wichtige Dateien

```
# Backend
backend/app/core/config.py          — Settings (FERNET_KEY, SMTP, DB)
backend/app/core/security.py        — JWT + bcrypt
backend/app/core/crypto.py          — Fernet encrypt/decrypt
backend/app/models/domain.py        — Listing, Conversation, Message
backend/app/scraper/selectors.py    — CSS-Selektoren (Fallback-Cascades)
backend/app/scraper/dispatcher.py   — Job-Handler (alle Actions)
backend/app/scraper/pages/          — Page Objects
backend/app/services/sessions.py    — Session encrypt/decrypt
backend/app/api/routers/            — FastAPI Routes

# Frontend
frontend/src/App.jsx                — Routes
frontend/src/components/Layout.jsx  — Nav (4 Items)
frontend/src/pages/                 — Alle Seiten
frontend/src/lib/api.js             — axios + Token-Refresh

# Infra
.env                                — Secrets (NIE committen)
.env.example                        — Template
docker-compose.yml                  — 5 Services
```

---

## 10. Notfall-Protokoll

### Wenn Opus ausfaellt
GPT uebernimmt Architektur-Entscheidungen. Lies dieses MASTERPLAN.md + HANDOFF.md. Halte dich an die Code-Regeln. Im Zweifel: konservativ bauen, nichts Bestehendes kaputt machen.

### Wenn GPT ausfaellt
Opus schreibt Code direkt (komplette Dateien per `cat > datei << 'EOF'`). Kimi/Terminal fuehrt aus.

### Wenn Kimi ausfaellt
Chef fuehrt Terminal-Befehle selbst aus. Opus/GPT liefern Copy-Paste-Befehle.

### Wenn alles ausfaellt
Chef hat dieses Dokument + das Repo. Jeder neue Agent kann einsteigen.

### Datei kaputt?
```bash
git checkout -- <datei>
```

### Container crashed?
```bash
docker compose ps
docker compose logs <service> --tail 50
docker compose up -d --force-recreate <service>
```

### Session-Encryption kaputt?
```bash
# Session invalidieren
docker compose exec postgres psql -U bubu bubukleinanzeigen-saas -c \
  "UPDATE kleinanzeigen_accounts SET session_encrypted=NULL, status='pending_login' WHERE id=<ID>;"
# Neu einloggen
cd backend && DATABASE_URL="postgresql+asyncpg://bubu:bubu_dev@127.0.0.1:5432/bubukleinanzeigen" \
  python3 -m app.scraper.cli_login --account-id <ID>
```

---

## 11. Chefs Wuensche (IMMER BEACHTEN)

1. **Kurz und direkt** — Keine Floskeln, kein "Gerne!", kein "Great question!"
2. **Klare Anweisungen** — Immer mit Empfaenger am Anfang (Terminal/ChatGPT/Kimi)
3. **Ergebnis > Erklaerung** — Erst machen, dann erklaeren
4. **Mobile-first** — iOS Safari muss funktionieren
5. **Ladezeiten sind kritisch** — Alles so schnell wie moeglich
6. **Hab eine Meinung** — Sag was du denkst, empfiehl, entscheide
7. **Proaktiv** — Fehler selbst fixen, nicht fragen ob du darfst
8. **Teste vor Commit** — Jede Aenderung verifizieren

---

## 12. Fuer einen NEUEN Opus (falls Konto wechselt)

Hallo, ich bin Chef (Aleks). Du bist Claude Opus — Architekt fuer BubuKleinanzeigen SaaS.

**Was du wissen musst:**
- Multi-Account Kleinanzeigen.de Management als SaaS
- Stack: FastAPI + React 18 + Playwright + PostgreSQL + Redis + Docker
- Live auf bubuanzeigen.de
- Mehrere KI-Agenten arbeiten zusammen (du, GPT, Kimi)
- Dieses MASTERPLAN.md ist deine Bibel
- Die Code-Regeln in Abschnitt 3 sind heilig
- Der Fehler-Katalog in Abschnitt 4 sind echte Fehler die passiert sind

**Dein Job:**
- Architektur-Entscheidungen treffen
- Code von GPT reviewen
- Schwierige Bugs fixen
- Den Plan vorantreiben (Roadmap in Abschnitt 7)
- Klare Anweisungen an GPT und Kimi formulieren

Lies jetzt HANDOFF.md und PROJECT_STATE.md, dann sag mir was als naechstes dran ist.

---

*Dieses Dokument wird bei jeder groesseren Aenderung aktualisiert. Letzter Stand: 2026-04-19.*
