# Project State

Zuletzt aktualisiert: 2026-07-05 (Session 6 — UX/Realtime-Ueberarbeitung)

## Aktueller Stand

Phase: **Komplett-Ueberarbeitung Runde 1 fertig (Echtzeit + Auto-Posting + Dashboard)**
Naechster Schritt: Chef-Tasks (Stripe, Cloudflare bububay.de DNS) → Live-Test → Launch.
Branch: claude-code/ux-final (enthaelt auch Infra-Pass INFRA-02 + Toast/Skeleton).

## Session 6 (2026-07-05): Komplett-Ueberarbeitung Runde 1

Ausloeser: Chef unzufrieden mit bububay.de, Vorbild anzeigenchef-online.de.
Konkurrenz-Analyse (AnzeigenChef 9,95 EUR/M, Kleinanzeigen-Enhanced ab 2,99 EUR/M):
deren Kern-Features Zeitplanung/Autoresponder/Vorlagen/Batch — BubuBay hatte alles
ausser **zeitgesteuertem Auto-Posting** und **Echtzeit**.

Neu implementiert:

1. **Echtzeit-Events (SSE)**: `shared/events.py` (Redis Pub/Sub, Kanal
   `events:user:{id}`), `GET /api/events/stream?token=` (SSE, Token als
   Query-Param weil EventSource keine Header kann). Dispatcher publiziert
   `conversations.updated`, `conversation.updated`, `listing.created`.
   Frontend: `lib/events.js` (Singleton-EventSource mit Reconnect),
   eingebunden in Layout (Badge sofort), MessagesPage (Inbox live),
   DashboardPage (Kacheln live). Polling bleibt als Fallback (30-60s).
2. **Message-Poll-Loop im Worker**: alle MESSAGE_POLL_SECONDS (default 90s)
   SCRAPE_MESSAGES fuer alle aktiven Accounts (dedupliziert) — eingehende
   Nachrichten kommen jetzt ohne Zutun des Users an, Push + SSE feuern.
3. **Auto-Posting-Scheduler**: Tabellen `posting_schedules` (pro Konto:
   posts_per_day, Zeitfenster, Tageszaehler) + `scheduled_listings`
   (Entwurfs-Warteschlange, Status queued/posting/posted/failed).
   Worker-Loop verteilt Posts gleichmaessig uebers Zeitfenster
   (Europe/Berlin, tzdata in requirements). CREATE_LISTING-Handler
   verbucht Draft-Status; Session-Expired requeued den Draft automatisch.
   API: /api/posting/schedules + /api/posting/queue (+ from-template,
   retry). Frontend: AutoPostPage unter /auto-post.
4. **Dashboard-Umbau**: neuer Endpoint `GET /ka-accounts/overview`
   (4 Batch-Queries: Listings/Views/Bookmarks, Unread, Auto-Queue pro
   Konto). Dashboard zeigt pro Konto Kacheln mit Inseraten/Views/
   Ungelesen/Auto-Queue + Schnellaktionen, aktualisiert sich alle 30s
   und sofort bei SSE-Events.
5. Migration 0011 (posting_schedules, scheduled_listings) — ausgefuehrt.

Verifiziert: alle Services laufen, Migration ok, Posting-API-Smoke-Test
(Schedule-Upsert, 400 bei ungueltigem Fenster, Draft-Queue, Overview),
SSE end-to-end (publish via Redis → Event am Stream empfangen).

## Session 6b (2026-07-05): AnzeigenChef-Desktop-Analyse + Runde 2

AnzeigenChef Desktop 2.1.046 (Demo, lokal installiert) per UI-Walkthrough
katalogisiert. Kernstruktur dort: Lifecycle-Ordner (Aktiv/Reserviert/Beendet/
Verkauft mit Unterstufen Zahlung/Abholung/Versand/Abgeschlossen/Abgebrochen),
Anzeigenausgang, Geplant, Nachrichten mit Blockliste+Spam+Archiv, Vorlagen,
Suchagent mit Verfuegbarkeits-Tracking, Makros, Multi-Plattform-Konten
(Kleinanzeigen/markt.de/Quoka/Shpock/willhaben), WaWi/Shop-Schnittstellen,
Community-Chat, MySQL-Mehrplatz. Featurekatalog als eigenstaendige
Web-Implementierung nachgebaut (kein Code/keine Assets uebernommen):

1. **Verkaufs-Pipeline** (Migration 0012): listings.sale_status
   (reserved/awaiting_payment/awaiting_shipping/awaiting_pickup/
   completed/cancelled) + sold_price/buyer_name/sale_note/sold_at.
   API: PATCH /listings/sale/{db_id}, GET /listings/sales-summary
   (Gesamtwerte aktiv/reserviert/in Abwicklung/verkauft).
   Frontend: SalesPage unter /sales mit Stufen-Boards, in Mobile-Nav.
2. **Nachrichten-Center**: conversations.is_spam + note; Inbox-Tabs
   (Inbox/Archiv/Spam) via view-Param; Antwort-Vorlagen
   (message_templates, Platzhalter {name}/{titel}); Blockliste
   (blocked_partners) — Scraper flaggt geblockte Partner bei jedem
   Scrape als Spam, unread-Badge zaehlt nur Inbox.

Offen fuer Runde 3 (aus AnzeigenChef-Katalog):
- Anzeigenausgang-Aequivalent: "Sofort veroeffentlichen"-Button in Auto-Post-Queue
- Suchagent-Ausbau: Treffer-Verfuegbarkeit, E-Mail-Alerts, Anfrage direkt senden
- Makro-Kuerzel in Inserat-Beschreibungen (Templates koennen es teilweise)
- Multi-Plattform (markt.de, Quoka, Shpock, willhaben) — grosser Brocken
- Shop/WaWi-Schnittstellen (WooCommerce zuerst)

Offen fuer Runde 2 (Ideen aus Konkurrenz-Analyse):
- KI-Anzeigenerstellung aus Fotos (Kleinanzeigen-Manager kann das)
- KI-Betrugsanalyse fuer eingehende Nachrichten (Kleinanzeigen-Enhanced)
- Bilder-Upload fuer Auto-Posting-Drafts (CREATE_LISTING kann noch keine Bilder)
- Multi-Plattform (eBay/markt.de/Shpock) — AnzeigenChef-USP, MULTI-01
- Views-Trend-Sparkline (UX-01)

## Session 5 (2026-05-22)

- Aufgabe 5: Inline-Beschreibung-Edit jetzt End-to-End. ListingUpdateIn.title
  optional, Backend fuellt fehlende Felder aus DB-Record vor enqueue. Patch ohne
  title schlaegt nicht mehr an Pydantic fehl.
- Aufgabe 6+7: Bulk-Aktionen und Multi-Account-Nachrichten bereits live —
  /listings/bulk-action Endpoint, Checkboxen + Bulk-Toolbar im Frontend,
  Account-Filter im Postfach + Konto-Badge in Inbox und ConversationView.
- Aufgabe 8: SCRAPE_LISTING_DETAIL Job-Typ. ListingDetailPage scrapt
  description via VIP_DESCRIPTION (#viewad-description-text Cascade).
  _handle_scrape_listings enqueued bis zu 5 Detail-Jobs pro Zyklus fuer
  Listings ohne Beschreibung (priority 6, kein Dedup).

## Was funktioniert

### Infrastruktur
- Alle 5 Docker-Services laufen (postgres, redis, backend, scraper, frontend)
- bubuanzeigen.de LIVE via Cloudflare Tunnel -> Mac Mini M4
- GitHub Repo, alle Commits gepusht
- SMTP (Gmail App-Passwort) funktioniert

### Auth
- Register, Login, Refresh, Logout -- komplett
- Passwort vergessen + Reset via E-Mail -- komplett
- JWT Access + Refresh Tokens
- Rate-Limiting auf Auth-Endpoints (slowapi): login 20/min, register 10/min, forgot-pw 5/min

### Kleinanzeigen-Accounts
- CRUD mit Plan-Limit-Check
- listing_count jetzt korrekt per Batch-Query (war vorher immer 0)
- Session-Encryption/Decryption end-to-end

### Scraper
- Alle Handler implementiert und funktional
- bookmark_count + view_count Scraping funktioniert
- Canary-Alerts (0 Ergebnisse) -> Email + Telegram Alert
- Parallele Selektor-Suche (max. 1x timeout statt N*timeout)

### Backend API
- Globaler Exception Handler (kein roher Stack-Trace an User)
- Rate-Limiting via slowapi
- N+1 Fixes: listing_count per Batch, messages stale-check per IN, /listings/all Endpoint
- Input-Validierung: EmailStr auf allen Email-Feldern

### Frontend
- Dashboard, Konten, Inserate, Nachrichten, Abrechnung, Einstellungen, Admin
- Theme-System: Hell/Dunkel + 5 Akzentfarben, persistiert in localStorage
- Dark Mode: .dark CSS-Overrides fuer alle hardcodierten Tailwind-Klassen
- PWA: manifest.json, Icons (192/512px), apple-touch-icon, offline.html, SW registriert
- Mobile Nav: 5 Items max (kein Overflow auf 375px)
- Cookie-Banner + Legal Pages (Impressum, Datenschutz, AGB)
- Admin Dashboard (nur fuer is_admin=True)
- Push Notifications (Web Push via VAPID)

### Phase 4 Infrastructure
- docker-compose.prod.yml (Nginx, kein Hot-Reload, kein Source-Mount)
- nginx/nginx.conf + conf.d/app.conf (HTTPS, HSTS, SPA-Fallback, Stripe-Webhook)
- scripts/backup-postgres.sh + restore-postgres.sh
- Uptime Kuma in Prod-Compose

## Was noch manuell noetig ist (Chef-Tasks)

- Stripe: Konto anlegen, Produkte erstellen, Keys in .env eintragen, Webhook registrieren
- Telegram: Bot-Token + Chat-ID in .env fuer Scraper-Alerts
- Legal Pages: Platzhalter durch echte Angaben ersetzen (Anwalt pruefen lassen)
- Impressum: Echte Adresse eintragen
- Icons: Professionelles Logo statt blauem "B" erstellen (optional)
- Alembic Migration: docker compose exec backend alembic upgrade head (nach DB-Reset)

## Known Issues / Fixes die durchgefuehrt wurden

- listing_count war immer 0 -- jetzt per Batch-Query korrekt berechnet
- N+1 in messages.py -- jetzt mit IN-Clause gebatcht
- ListingsPage: N API-Calls pro Account -> jetzt /listings/all (1 Call)
- PasswordResetRequestIn: war `str` statt `EmailStr` -- gefixt
- PWA-Icons: *.png war in .gitignore, Exception fuer frontend/public/*.png hinzugefuegt
- Nachrichten-Scraper (SCRAPE_MESSAGES): Kleinanzeigen SPA-Migration — kein iframe mehr.
  Neues DOM: article.ConversationListItem, ID aus input[data-testid] ('lnjz:1s2bvvw:...').
  MessagesPage.py: get_messages_frame() faellt auf self.page zurueck. 4 Conversations gescraped.
- Konversations-Scraper (SCRAPE_CONVERSATION): ConversationPage.py vollstaendig neu.
  Neue Selektoren: li[data-testid] fuer Messages, [class*=Message--Text] fuer Body,
  data-testid=OUTBOUND fuer Outgoing, textarea#nachricht + data-testid=submit-button fuer Reply.
  Direkte URL mit neuem ID-Format funktioniert (?conversationId=lnjz:1s2bvvw:...).
  7 Messages erfolgreich gescraped (verifiziert Session 3).
- Scraper Worker: asyncio.gather in shutdown konnte haengen; 15s timeout + cancel hinzugefuegt.

## Session-Log

### 2026-04-21: Feature-Finalisierung + E2E-Fix

Fertiggestellt:
1. Phase 7.9: Inserat erstellen (CreateListingPage, dispatcher, API, Frontend-Panel)
2. Phase 7.11: Multi-Account Dashboard (Views + Ungelesene ueber alle Konten)
3. Phase 7.12: Session Auto-Renewal (6h-Checker-Loop + Push-Notification bei Ablauf)
4. recharts: npm install + Docker-Image rebuild (war nur auf Host installiert)
5. scraper: pywebpush fehlte im Image → rebuild behoben
6. Frontend: --renew-anon-volumes benoetigt damit node_modules-Volume aktualisiert wird
7. Alembic Migrationen 0004-0006 ausgefuehrt (auto-bump, listing_stats, notification_settings)
8. .env.example: FERNET_KEY, VAPID-Keys, Telegram, ALERT_EMAIL_TO ergaenzt
9. MASTERPLAN.md + PROJECT_STATE.md auf aktuellen Stand gebracht

### 2026-04-20: Quality Phase

Fertiggestellt:
1. Mobile Responsive: Nav auf 5 Items begrenzt (375px-sicher)
2. API-Fehlerbehandlung: Globaler Exception Handler in main.py
3. Dark Mode: .dark CSS-Overrides fuer bg-white/bg-slate-*/text-slate-*/border-slate-*
4. PWA: manifest.json, Icons, offline.html, SW mit install/activate/fetch
5. N+1-Fixes: /listings/all, messages batch, listing_count batch
6. Rate-Limiting: slowapi auf Auth-Endpoints
7. Input-Validierung: EmailStr fix

### 2026-04-20: Roadmap abgearbeitet (Tasks 9-15)

- Task 9: Admin Dashboard (stats, users, jobs, accounts -- 4 Tabs)
- Task 10: Email + Telegram Alerts bei Scraper-Fehlern
- Task 11: Theme-System (CSS-Vars, Dark Mode, 5 Akzentfarben, SettingsPage)
- Task 12: docker-compose.prod.yml + Nginx-Reverse-Proxy
- Task 13: Postgres Backup + Restore Scripts
- Task 14: Uptime Kuma in Prod-Compose
- Task 15: Legal Pages + Cookie-Banner

### 2026-04-19: Phase 1+2+3 (Tasks 1-8)

- Phase 1: Alembic Migration, Session-Banner, DOM-Haertung
- Phase 2: Stripe Integration (Checkout, Webhook, BillingPage)
- Phase 3: Push Notifications (VAPID, pywebpush, ServiceWorker)
- Phase 3: Admin Dashboard Backend

## Notizen

- Docker Service-Namen: backend, frontend, postgres, redis, scraper
- Dateien IMMER lesen vor Aenderung
- Kein sed fuer mehrzeilige Aenderungen
- cli_login.py laeuft NUR auf dem Host (nicht in Docker), braucht GUI/DISPLAY
- bookmark_count Selektor: gleiche DOM-Section wie view_count, Regex-basiert
