# Project State

Zuletzt aktualisiert: 2026-04-16 (Ende Session 2)

## Aktueller Stand

Phase: Session 2 abgeschlossen
Nächster Schritt: Session 3 — Listings UI + Listings-Actions

## Was funktioniert

- Alle 5 Docker-Services laufen (postgres, redis, backend, scraper, frontend)
- Auth-Flow komplett (Register, Login, Refresh, Logout)
- Kleinanzeigen-Accounts CRUD mit Plan-Limit-Check
- Job-Queue end-to-end (DB + Redis)
- Scraper-Worker läuft, wartet auf Jobs
- Scraper-Foundation: Selectors, BasePage, LoginPage, ListingsPage, SessionManager
- START_LOGIN, VERIFY_SESSION, SCRAPE_LISTINGS Handler implementiert
- Frontend: Login, Register, Dashboard, Accounts-Page mit Login-Button
- Modal funktioniert (Bug in Session 2 gefixt)
- cli_login.py als Host-CLI für sichtbares Browser-Login vorbereitet

## Was NICHT funktioniert / offen

- Sichtbarer Login-Browser nicht getestet (cli_login.py läuft noch nicht scharf)
- Listings-UI ist Placeholder ("Bald")
- Nachrichten komplett offen
- Stripe offen
- Admin-Dashboard offen
- Deployment offen

## Known Issues

- Erste DB-Migration muss manuell laufen: docker compose exec backend alembic upgrade head
- GLM-5.1 kann Dateien groesser 2KB nicht zuverlaessig schreiben — Cursor nutzen stattdessen

## Session-Log

### 2026-04-16: Session 2 — Scraper-Foundation

Fertiggestellt:
- selectors.py (Selektor-Cascades mit Regex fuer stabile IDs)
- pages/base.py (BasePage mit try_selectors, Fallback-Warnings)
- pages/login_page.py (sichtbarer Login, Session-Capture)
- pages/listings_page.py (Scrape mit stabilen IDs, UPSERT)
- services/sessions.py (Fernet-verschluesselte storage_state)
- session_manager.py komplett (Playwright-Integration, per-Account Locks)
- dispatcher.py mit echten START_LOGIN, VERIFY_SESSION, SCRAPE_LISTINGS Handlern
- api/routers/kleinanzeigen_accounts.py (POST /start-login, /refresh, /verify)
- cli_login.py (Host-CLI fuer visible Login)
- Frontend: AccountsPage mit Login-Buttons, Status-Badges, Listing-Count
- Modal.jsx Bug gefixt (Transform-Konflikt, Click-Through)
- Unicode-Escape-Bugs in AccountsPage behoben
- api.js Token-Pair-API (storeTokenPair, readTokenPair, removeTokenPair)
- useAuth.jsx angepasst an neue api.js

Architektonische Entscheidung (ADR-006):
- Visible Login als Host-CLI-Subprocess (Option B aus HANDOFF.md Session 2 Plan), nicht im Docker-Container. Grund: X11-Forwarding auf macOS zu fragil fuer MVP.

## Notizen fuer naechsten Agenten

- Cursor statt GLM fuer Datei-Schreiben nutzen
- GPT liefert portionsweise (max 3 Dateien pro Nachricht)
- Bei Umlauten IMMER echte Zeichen (ü, ö, ä), nie Escape-Sequenzen (\u00fc)
- Modal.jsx funktioniert jetzt — nicht mehr anfassen
