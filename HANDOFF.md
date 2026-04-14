# BubuKleinanzeigen SaaS — Agent Handoff

**Version:** 1.0 | **Status:** Session 1 Teil 2 abgeschlossen | **Projekt-Domain:** bubuanzeigen.de

---

## Für den KI-Agenten: Lies das ZUERST

Du übernimmst ein laufendes SaaS-Projekt. Architektur und Foundation-Code wurden von Claude Opus 4.6 entworfen. Deine Aufgabe: **das Projekt nach dem hier dokumentierten Plan fertigstellen**.

**Dein erster Schritt immer:**
1. Lies diese `HANDOFF.md` komplett
2. Lies `PROJECT_STATE.md` — dort steht was zuletzt gemacht wurde und was als nächstes dran ist
3. Schau in den Code: `backend/app/` und `frontend/src/` um zu verstehen was existiert
4. Erst DANN fang an zu coden

**Dein letzter Schritt immer:**
- Aktualisiere `PROJECT_STATE.md` mit dem was du gemacht hast
- Commite alles mit klaren Commit-Messages
- Falls du architektonische Entscheidungen getroffen hast: dokumentier sie in `docs/DECISIONS.md`

---

## 1. Projekt-Übersicht

### Was ist BubuKleinanzeigen SaaS?

Eine Multi-Account-Management-Webapp für Kleinanzeigen.de. User (Kunden) verbinden ihre Kleinanzeigen-Konten mit der App und verwalten von dort aus:

- Nachrichten aus allen Konten in einer zentralen Inbox
- Inserate ansehen, bearbeiten, löschen, hochschieben (bump)
- Neue Inserate erstellen mit Vorlagen
- Mobile PWA mit Push-Notifications
- Statistiken und Auswertungen

Die App ist ein **Werkzeug**. User sind selbst verantwortlich für die Einhaltung der Kleinanzeigen-AGB. Analog zu Adobe Photoshop: Adobe haftet nicht dafür, wie User das Tool einsetzen.

### Zielgruppe

- Haushaltsauflöser, Flohmarkt-Dauerverkäufer
- Kleine Second-Hand-Shops, gewerbliche Kleinanbieter
- Sammler die Sammlungen verkaufen
- Nicht-Zielgruppe: Dropshipping, Arbitrage, automatisierte Bot-Farmen

### Geschäftsmodell

Monatliches Abo über Stripe:
- **Starter** 9€/Monat, 1 Kleinanzeigen-Konto
- **Pro** 19€/Monat, 3 Konten
- **Business** 39€/Monat, 10 Konten

Realistisches Ziel: 150 zahlende User nach 6-12 Monaten, ca. 2500€ MRR.

---

## 2. Arbeitsregeln (STRIKT)

### Kommunikation

- **Deutsch** im Chat mit dem Chef (dem Betreiber, dem User der dir den Prompt schickt)
- **Englisch** für Code-Kommentare, Commit-Messages, Docstrings
- **Deutsch** für alle UI-Texte (Labels, Buttons, Error-Messages fürs Frontend)
- Keine Floskeln wie "Great question!" oder "Gerne helfe ich!"
- Direkte, knappe Antworten. Chef will Ergebnisse, keine Erklärungen
- Sei proaktiv: Fehler selbst fixen, nicht fragen ob du fixen darfst
- Actions > Words: erst machen, dann erklären
- Hab eine Meinung. Wenn etwas architektonisch falsch ist, sag es direkt
- Teste bevor du fertig bist — jede Änderung verifizieren

### Code-Standards

**Sprachen-Versionen (nicht ändern):**
- Python 3.11
- Node 20
- React 18 (KEIN React 19)
- axios **0.27.2** (axios 1.x verursacht destroy-Fehler mit Vite HMR)

**Frontend-Regeln (nicht verletzen):**
- **Kein `useEffect`** — nutze `if (!loaded) { setLoaded(true); load() }` Pattern
- **Kein React StrictMode** — verursacht Double-Mount
- **Keine lucide-react Icons** — nur Emojis als Strings: `{'📋'}` nicht `<Icon />`
- **Emojis in JSX als Strings**: `'📦'` nicht `📦`
- **Mobile-first Design**, iOS Safari Kompatibilität ist Pflicht
- **Panel-Slides via CSS `translate3d` Transform**, nicht conditional rendering (vermeidet removeChild-Crashes auf Mobile Safari)
- **Listen:** immer stabile IDs als React `key`, nie Array-Index
- Tailwind für Styling, keine styled-components
- Tabs für Indentation in Python (4 Spaces), 2 Spaces in JS/JSX

**Backend-Regeln:**
- Async-only (FastAPI + SQLAlchemy async)
- Pydantic v2 für Schemas
- Alembic für Migrationen
- Keine synchronen DB-Calls in Async-Context

**Git-Regeln:**
- Commit-Messages: Englisch, Imperativ, prefix mit `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`
  - Beispiel: `feat: add Kleinanzeigen login page for session capture`
- Ein Commit pro logischer Änderung (nicht 50 Dateien in einem Commit)
- Bevor du committest: Code lokal testen wenn möglich

---

## 3. Tech-Stack

### Architektur

```
┌─────────────┐      ┌──────────────┐      ┌──────────────────┐
│   Frontend  │─────▶│  FastAPI     │─────▶│   PostgreSQL     │
│ React 18 PWA│◀─────│  Backend     │◀─────│   (Source of     │
└─────────────┘  WS  │              │      │    Truth)        │
                     └──────┬───────┘      └──────────────────┘
                            │ enqueues                ▲
                            ▼                         │ writes
                     ┌──────────────┐      ┌─────────┴────────┐
                     │ Redis Queue  │─────▶│ Scraper Worker   │
                     │ (Priority)   │      │ (Playwright)     │
                     └──────────────┘      │ separater Prozess│
                                           └──────────────────┘
```

**Entscheidender Punkt:** Frontend liest **NUR** aus DB. User-Aktionen erzeugen Jobs (in Postgres + Redis Queue). Scraper-Worker pollt Queue, macht Arbeit, schreibt Ergebnis in DB. Frontend pollt Job-Status oder bekommt Push via WebSocket.

### Stack

| Schicht | Technologie |
|---------|-------------|
| Frontend | React 18, Vite, TailwindCSS, vite-plugin-pwa, axios 0.27.2 |
| Backend API | FastAPI, Pydantic v2, SQLAlchemy 2 async, asyncpg |
| Datenbank | PostgreSQL 16 |
| Queue/Cache | Redis 7 |
| Scraper | Playwright (headless Chromium) |
| Auth | JWT (Access + Refresh), bcrypt |
| Payments | Stripe (kommt in Session 6) |
| Deployment | Docker Compose, Cloudflare Tunnel |
| Hosting | Hetzner Cloud CX22 (7€/Monat) |

---

## 4. Datenmodell

**WICHTIG:** Alle Kleinanzeigen-IDs werden als **Strings** gespeichert, extrahiert aus URLs. NIEMALS Array-Indices nutzen. Das ist die Kernlehre aus dem Vorgänger-Projekt.

### Tabellen

**`users`** — SaaS-Kunden
- `id`, `email` (unique), `password_hash`, `full_name`
- `is_active`, `is_admin`
- `plan` (free/starter/pro/business), `stripe_customer_id`, `subscription_status`, `subscription_expires_at`

**`kleinanzeigen_accounts`** — verknüpfte KA-Konten (ein User kann mehrere haben)
- `user_id` (FK), `label` (User-gegebener Name)
- `kleinanzeigen_user_name`, `kleinanzeigen_user_id`
- `session_encrypted` (Fernet-verschlüsseltes Playwright storage_state JSON)
- `status` (pending_login/active/session_expired/banned/disabled)
- `last_scraped_at`, `last_error`

**`listings`** — Inserate
- `account_id` (FK), `kleinanzeigen_id` (String, aus URL-Pattern `/(\d{9,})-/`)
- `title`, `price`, `price_type`, `category`, `description`, `location`
- `image_url`, `url`, `view_count`, `expires_at`, `is_active`
- Unique: `(account_id, kleinanzeigen_id)`

**`conversations`** — Chat-Threads
- `account_id` (FK), `kleinanzeigen_id` (aus URL `conversationId=X`)
- `listing_kleinanzeigen_id`, `partner_name`, `subject`
- `last_message_preview`, `last_message_at`, `unread_count`

**`messages`** — einzelne Nachrichten in einer Konversation
- `conversation_id` (FK), `kleinanzeigen_id`
- `direction` (incoming/outgoing), `sender_name`, `body`, `sent_at`, `is_read`

**`jobs`** — async Tasks für den Scraper
- `account_id` (FK, nullable), `type` (enum), `status` (pending/running/success/failed/retrying)
- `priority` (1=high, 10=low), `payload` (JSONB), `result` (JSONB), `error_message`
- `screenshot_path` (für debug-on-fail), `attempts`, `max_attempts`

---

## 5. Was bereits existiert

### Backend (`backend/app/`) — komplett implementiert

**Core:**
- `core/config.py` — Pydantic-Settings aus `.env`
- `core/security.py` — JWT Access+Refresh Tokens, bcrypt Password-Hashing
- `core/crypto.py` — Fernet-Verschlüsselung für Kleinanzeigen-Sessions

**DB:**
- `db/session.py` — async SQLAlchemy, `get_db()` Dependency

**Models (alle komplett):**
- `models/user.py` — User + SubscriptionPlan-Enum + PLAN_LIMITS
- `models/kleinanzeigen_account.py` — KleinanzeigenAccount + AccountStatus
- `models/domain.py` — Listing, Conversation, Message
- `models/job.py` — Job + JobStatus + JobType

**Schemas:**
- `schemas/auth.py` — User-Register/Login, TokenPair, UserOut
- `schemas/resources.py` — alle Resource-DTOs

**API-Router (komplett):**
- `api/deps.py` — `get_current_user`, `get_current_admin` via JWT
- `api/routers/auth.py` — Register, Login, Refresh, Me
- `api/routers/kleinanzeigen_accounts.py` — CRUD + Plan-Limit-Check + Refresh/Verify-Triggers
- `api/routers/jobs.py` — Job-Status-Polling
- `api/routers/listings.py` — Stale-while-revalidate Read
- `api/routers/messages.py` — Conversations, Messages, Send
- `api/main.py` — App-Entry mit CORS + Router-Mounting

**Services:**
- `services/jobs.py` — `enqueue_job()` Service (atomarer DB-Insert + Redis-Push)

**Shared:**
- `shared/queue.py` — Redis-Queue mit 3 Priority-Lanes (high/normal/low)

**Scraper (Skelett — Handler sind Stubs, echte Logik kommt in Session 2):**
- `scraper/worker.py` — Runtime-Loop mit Shutdown-Handling, Semaphore-Limits, Retries, Screenshot-on-Fail
- `scraper/dispatcher.py` — Handler-Routing (alle Stubs)
- `scraper/session_manager.py` — Browser-Lifecycle-Skelett mit per-Account-Locks, `capture_debug_snapshot()`

**Migrations:**
- `migrations/0001_initial.py` — komplette Initial-Migration (alle Tabellen + Indexes + Constraints)
- `alembic.ini` + `migrations/env.py` (async-kompatibel)

**Docker:**
- `backend/Dockerfile` — API-Container (Python 3.11-slim)
- `backend/Dockerfile.scraper` — Scraper-Container (offizielles Playwright-Image)

### Frontend (`frontend/`) — Skelett

**Fertig:**
- `package.json` (React 18, axios 0.27.2, Vite, Tailwind, vite-plugin-pwa)
- `Dockerfile`
- `vite.config.js` (PWA-Manifest, API-Proxy zu backend, kein StrictMode)

**Fehlt noch (Session 1 Teil 3):**
- `index.html`
- `src/main.jsx` (ohne StrictMode!)
- `src/App.jsx` mit React Router
- `src/hooks/useAuth.jsx` — Auth-Context + Token-Management
- `src/lib/api.js` — axios-Instance mit Refresh-Token-Interceptor
- `src/pages/LoginPage.jsx`
- `src/pages/RegisterPage.jsx`
- `src/pages/DashboardPage.jsx` — Übersicht
- `src/pages/AccountsPage.jsx` — KA-Konten verbinden/verwalten
- `src/components/Layout.jsx` — Bottom-Nav mobil, Sidebar desktop
- `src/styles/index.css` — Tailwind-Imports
- `tailwind.config.js`, `postcss.config.js`

### Root-Ebene

- `docker-compose.yml` — postgres, redis, backend, scraper, frontend
- `.env.example` — alle Config-Variablen
- `README.md` — kurze Übersicht + Setup

---

## 6. Session-Plan (was noch zu tun ist)

### ✅ Session 1 Teil 1+2: Foundation (abgeschlossen)
Infrastruktur, Datenmodell, Backend-API, Scraper-Skelett.

### ⏳ Session 1 Teil 3: Frontend-Skelett (DU BIST HIER)

**Ziel:** Lauffähige Web-App — User kann sich registrieren, einloggen, ein Kleinanzeigen-Konto anlegen (leer, noch ohne echten Login).

**Dateien zu bauen:**
- `frontend/index.html`
- `frontend/postcss.config.js`, `frontend/tailwind.config.js`
- `frontend/src/main.jsx` (KEIN StrictMode)
- `frontend/src/App.jsx` (React Router mit protected routes)
- `frontend/src/styles/index.css` (Tailwind base/components/utilities)
- `frontend/src/lib/api.js` (axios 0.27.2 instance + JWT interceptor + refresh logic)
- `frontend/src/hooks/useAuth.jsx` (Context + Provider, localStorage-basiert)
- `frontend/src/components/Layout.jsx` (mobile bottom-nav + desktop sidebar)
- `frontend/src/pages/LoginPage.jsx`
- `frontend/src/pages/RegisterPage.jsx`
- `frontend/src/pages/DashboardPage.jsx` (zeigt verknüpfte Accounts)
- `frontend/src/pages/AccountsPage.jsx` (CRUD)

**Akzeptanzkriterien:**
- `docker compose up` startet alles
- `http://localhost:3000/register` funktioniert, anschließend automatischer Login
- Dashboard zeigt "Du hast 0 verbundene Konten"
- User kann auf "Konto hinzufügen" klicken, Label eingeben, Konto erscheint in Liste
- Plan-Limit (Free = 1 Konto) wird im UI respektiert

### ⏳ Session 2: Scraper-Implementierung

**Ziel:** Kleinanzeigen-Login via Browser (visible) + Session-Speicherung + erste echte Scraper-Jobs.

**Dateien zu bauen:**
- `backend/app/scraper/selectors.py` — zentrale Selektor-Cascades mit Fallback-Ketten
- `backend/app/scraper/pages/base.py` — BasePage mit `try_selectors()` und Warning-Logging bei Fallbacks
- `backend/app/scraper/pages/login_page.py` — visibles Browser-Fenster, wartet auf Login-Redirect, speichert `storage_state()` verschlüsselt in DB
- `backend/app/scraper/pages/listings_page.py` — scrapet Inserate mit stabilen IDs
- Handler-Implementierungen in `dispatcher.py`:
  - `VERIFY_SESSION` — lädt Session, prüft ob noch eingeloggt
  - `SCRAPE_LISTINGS` — scrapet Inserate, speichert in DB
- Neue API-Endpunkte:
  - `POST /api/ka-accounts/{id}/start-login` — startet Playwright visible mode (nur lokal sinnvoll, später via VNC oder Cloud-Browser)

**Wichtige Implementierungs-Details:**

Selektor-Cascade-Pattern:
```python
class Selectors:
    AD_LIST_ITEM = [
        'article.aditem',           # primär
        '[data-adid]',              # zukunftssicher (data-attrs stabiler)
        'li.ad-listitem',           # historisch
    ]
    AD_ID_FROM_LINK = [
        ('a[href*="/s-anzeige/"]', 'href', r'/(\d{9,})-'),
    ]
    AD_IMAGE = [
        ('img[srcset]', 'srcset'),
        ('img[data-srcset]', 'data-srcset'),
        ('img[data-src]', 'data-src'),
        ('img', 'src'),
    ]
```

BasePage.try_selectors() — probiert Alternativen der Reihe nach, loggt WARNING wenn Fallback matched (Frühwarnsystem für UI-Änderungen).

Page-Reuse pro Account: Ein Playwright Context/Page pro KleinanzeigenAccount, lebt über viele Jobs. Spart 80% Ladezeit.

Parallel über Accounts, seriell innerhalb eines Accounts (per-Account-Lock).

`wait_for_selector` statt `asyncio.sleep` — immer.

### ⏳ Session 3: Listings-UI + Listings-Actions

- Frontend: Listings-Übersicht mit Filter, Detailansicht, Edit-Formular
- Backend: UPDATE_LISTING, DELETE_LISTING, BUMP_LISTING Handler
- Page Objects: `edit_listing_page.py`

### ⏳ Session 4: Messages-Inbox + Reply

- Frontend: zentrale Inbox über alle Accounts, Chat-View mit Read-Marks
- Backend: SCRAPE_MESSAGES, SCRAPE_CONVERSATION, SEND_MESSAGE Handler
- **Iframe-Handling** im Chat: `iframe.content_frame()` Pattern
- Page Objects: `messages_page.py`, `conversation_page.py`
- WebSocket-Endpunkt für Live-Push neuer Nachrichten

### ⏳ Session 5: Web Push Notifications

- VAPID-Keys generieren (config)
- Neue Tabelle `push_subscriptions` (user_id, endpoint, keys)
- Service Worker im Frontend registrieren
- Backend: `pywebpush` zum Versenden
- UI: "Benachrichtigungen aktivieren" Button, Berechtigung anfragen
- Trigger: neue eingehende Nachricht → Push

### ⏳ Session 6: Stripe-Integration

- Stripe-Konto einrichten, Produkte + Preise anlegen
- Backend:
  - `POST /api/billing/checkout-session` — erstellt Stripe Checkout
  - `POST /api/billing/webhook` — verarbeitet `checkout.session.completed`, `customer.subscription.updated/deleted`
  - Plan-Gating überall nachziehen (z.B. Message-Senden nur bei aktivem Abo)
- Frontend: Billing-Seite, Upgrade-Button, Stripe Customer Portal Link

### ⏳ Session 7: Admin-Dashboard + Monitoring

- Admin-Route `/admin` (nur `is_admin=True`)
- User-Liste, Subscription-Status, Account-Health
- Scraper-Health-Dashboard: letztes Scrape pro Account, Fehlerraten
- Alert-System: Telegram/E-Mail-Ping bei Fallback-Selektor-Hits
- Prometheus-Metriken exportieren (optional)

### ⏳ Session 8: Production-Deploy

- Hetzner Cloud CX22 mieten
- Docker Compose auf Server deployen
- Cloudflare Tunnel für bubuanzeigen.de
- Let's Encrypt via Cloudflare (automatisch durch Tunnel)
- Backups (Postgres-Dump täglich → Backblaze B2 oder S3)
- Logging: structlog + Loki/Grafana oder einfach `docker logs` mit rotation
- Uptime-Monitoring via Uptime Kuma (self-hosted) oder Uptime Robot
- Launch-Checklist: Impressum, DSGVO, AGB, Cookie-Banner, Kontakt-E-Mail

---

## 7. Kritische Implementierungs-Hinweise

### Stabile IDs — das Wichtigste

Kleinanzeigen-URLs haben das Format `/s-anzeige/{slug}/{id}-{kind}-{userid}`. Die `{id}` ist eine 9-11-stellige Zahl und ist die einzige stabile Kennung. Sie wird immer als **String** gespeichert (führende Nullen möglich, keine arithmetischen Operationen nötig).

Regex zum Extrahieren: `r'/(\d{9,})-'`

Für Konversationen: URL-Parameter `conversationId=X` → `X` ist die stabile ID.

### Playwright-Session-Management

Login-Flow:
1. Playwright startet mit `headless=False`, `storage_state=None`
2. User loggt sich manuell ein
3. Scraper pollt auf Redirect zu `/m-meine-anzeigen.html*` als Success-Signal
4. Scraper ruft `context.storage_state()` auf
5. Resultat wird mit `core/crypto.py` verschlüsselt und in `KleinanzeigenAccount.session_encrypted` gespeichert
6. Folge-Jobs laden Session via `storage_state=decrypt(account.session_encrypted)`, laufen headless

Für Production: visibler Login lokal nicht möglich. Lösung: Cloud-Browser-Service (Browserbase, Browserless) oder VNC-in-Container + User-URL. Für MVP reicht lokaler Login.

### Mobile-Safari-Fixes (aus Vorgänger-Projekt gelernt)

**removeChild-Crash bei Panel-Schließen:**
Fix: Panel immer im DOM lassen, nur per CSS verschieben.
```jsx
<div style={{
  transform: isOpen ? 'translate3d(0,0,0)' : 'translate3d(100%,0,0)',
  pointerEvents: isOpen ? 'auto' : 'none',
  willChange: 'transform',
}} className="fixed inset-0 z-50 transition-transform duration-200">
  {isOpen && <DetailContent key={stableId} />}
</div>
```

**Fixed Nav scrollt mit Content:**
Ursache: ein Vorfahre hat `transform`, `filter`, `perspective`, `will-change` oder `contain` — das erzeugt einen neuen Containing Block. Fix: diese CSS-Properties von Vorfahren entfernen.

**Panel-Scroll stoppt vor Button:**
Fix: Flex-Layout mit `100dvh` (dynamic viewport), innerer Container mit `overflow-y-auto`:
```jsx
<div className="flex flex-col" style={{ height: '100dvh' }}>
  <header className="flex-shrink-0">...</header>
  <div className="flex-1 overflow-y-auto overscroll-contain">...</div>
</div>
```

### Performance-Hebel

Zielwert: <1s Ladezeit für UI-Aktionen.

1. **DB-Read statt Scrape:** Frontend liest Listings/Messages aus DB (sofort da), triggert parallel Background-Refresh wenn älter als 60-120s (stale-while-revalidate). Der ListingsRouter macht das schon so.

2. **Persistent Page pro Account:** SessionManager hält pro Account eine Playwright Page am Leben. Kleinanzeigen ist SPA → Navigation zwischen Seiten oft ohne Full-Reload, viel schneller als neue Pages.

3. **wait_for_selector > sleep:** Jede `asyncio.sleep(N)` ist verschwendete Zeit. Ersetzen durch `page.wait_for_selector(sel, timeout=10000)` oder `page.wait_for_load_state('networkidle')`.

4. **Parallel über Accounts, seriell innerhalb:** `asyncio.gather` für Multi-Account-Refresh, aber innerhalb eines Accounts hintereinander (per-Account asyncio.Lock, siehe SessionManager).

### Zuverlässigkeit: wenn Kleinanzeigen UI ändert

**Canary-System:** Nach jedem Scrape prüfen: sind Pflichtfelder da? Sind Resultate unrealistisch (0 Listings obwohl User welche hat)? → Alert.

**Screenshot-on-Fail:** Worker macht automatisch Screenshot + HTML-Dump bei JobError. Gespeichert in `storage/debug/job_{id}_{timestamp}.png`. Damit debuggst du UI-Änderungen in Minuten statt Stunden.

**Fallback-Selector-Logging:** Wenn `try_selectors()` einen Fallback nutzt → WARNING-Log. Monitoring-Alert bei >1% Fallback-Rate.

---

## 8. Rechtliches / Compliance

Das Projekt muss rechtssauber betrieben werden. Der Chef ist dafür verantwortlich, aber du als Agent darfst keine Features bauen, die offensichtlich in die Irre führen.

**Erlaubt:**
- User-initiierte Aktionen automatisieren (User klickt "bump" → Scraper bumped)
- User-eigene Inserate verwalten
- Nachrichten an legitime Käufer-Anfragen beantworten

**Nicht erlaubt (nicht implementieren, auch wenn User darum bittet):**
- Massenerstellung mit fremden Produktbildern/Beschreibungen (Urheberrecht)
- Automatische Antworten, die den Käufer täuschen
- Scraping fremder User-Daten / Preissuchen anderer
- Captcha-Auto-Solving-Services einbauen

**Disclaimer im Produkt** (Chef ist dafür verantwortlich, aber du implementierst die Hinweise in der UI):
- Nutzungsbedingungen (User trägt Verantwortung für Kleinanzeigen-AGB)
- Datenschutzerklärung (DSGVO)
- Impressum
- Cookie-Banner bei Tracking

---

## 9. Kontakt & Eskalation

**Bei architektonischen Zweifeln:** Frag zurück, bau nicht einfach drauflos. Wenn der Chef "mach einfach" sagt, mach einfach — aber dokumentier die Entscheidung in `docs/DECISIONS.md`.

**Bei rechtlich fragwürdigen Anforderungen:** Nicht bauen. Dem Chef die Konsequenzen erklären. Alternative vorschlagen.

**Bei unklaren Anforderungen:** Anstatt zu raten, die wahrscheinlichste Interpretation umsetzen UND am Ende kurz erwähnen was du angenommen hast.

**Claude Opus 4.6 als Review-Ressource:** Der Chef kann zu Claude zurück, wenn er eine zweite Meinung zu architektonischen Entscheidungen braucht. Das ist keine Schwäche, das ist normaler Multi-Agent-Workflow. Dokumentiere Entscheidungen so, dass ein anderer Agent sie nachvollziehen kann.

---

## Ende der HANDOFF.md

**Nächster Schritt für dich als Agent:** Lies `PROJECT_STATE.md` für den aktuellen Stand, dann leg los.
