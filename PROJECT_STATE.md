# Project State

Zuletzt aktualisiert: 2026-04-19 (Session 5 Stabilisierung)

## Aktueller Stand

Phase: Sessions 1-4 abgeschlossen + Phase 1 Stabilisierung DONE
Naechster Schritt: Phase 2 -- Stripe Integration (Task 5+6+7)

## Was funktioniert

### Infrastruktur
- Alle 5 Docker-Services laufen (postgres, redis, backend, scraper, frontend)
- bubuanzeigen.de LIVE via Cloudflare Tunnel -> Mac Mini M4
- GitHub Repo public, alle Agents haben Zugriff
- SMTP (Gmail App-Passwort) funktioniert

### Auth
- Register, Login, Refresh, Logout -- komplett
- Passwort vergessen + Reset via E-Mail -- komplett und getestet
- JWT Access + Refresh Tokens

### Kleinanzeigen-Accounts
- CRUD mit Plan-Limit-Check
- cli_login.py funktioniert (sichtbarer Browser auf Host)
- FERNET_KEY Persistenz (Commit f511aa2)
- Session-Encryption/Decryption end-to-end verifiziert
- Account 4 active, 14 Listings, scrape_listings erfolgreich

### Scraper
- Alle Handler implementiert und funktional
- bookmark_count Scraping funktioniert (Commit f66fb6d)
- Selectors mit Fallback-Cascades
- Alle Page Objects implementiert

### Frontend
- Dashboard, Konten, Inserate, Nachrichten -- alle Seiten da
- Inserate zeigen Views + Bookmark-Count (Herz-Icon)
- LoginPage sauber (ein Passwort-vergessen-Link)

## Was NICHT funktioniert / offen

- Stripe Integration komplett offen
- Admin Dashboard komplett offen
- Push Notifications komplett offen
- Production Deployment (laeuft auf Mac Mini, nicht auf Server)

## Known Issues

- Erste DB-Migration muss manuell: docker compose exec backend alembic upgrade head
- Docker Service heisst "scraper", NICHT "worker"
- cli_login.py braucht lokale DATABASE_URL mit 127.0.0.1, nicht "postgres"
- cli_login.py braucht Python 3.11 venv, nicht System-Python 3.9
- Smart Quotes von GPT muessen vor Einspielen geprueft werden
- Selektoren fuer Bump/Delete/Edit gegen Live-DOM pruefen (DOM-Haertung noetig)

## Session-Log

### 2026-04-19: Phase 1 Stabilisierung abgeschlossen (Tasks 1-3)

Fertiggestellt:
- Task 1: Alembic Migration 0002_add_bookmark_count (ADD COLUMN IF NOT EXISTS, idempotent)
- Task 2: Session-Auto-Refresh
  - api.js: setSessionExpiredHandler() Hook wenn Refresh-Token ungueltig
  - useAuth.jsx: sessionExpired-State + dismissSessionExpired()
  - Layout.jsx: Amber-Banner mit "Neu einloggen"-Button statt stillem Logout
- Task 3: DOM-Haertung
  - base.py: wait_for_selector_list() rast jetzt alle Selektoren parallel statt sequentiell
    (vorher worst case 3x10s=30s, jetzt immer max. 10s)
  - dispatcher.py: Canary-Check nach scrape_listings + scrape_messages
    (0 Ergebnisse = WARNING + automatischer Debug-Snapshot)

### 2026-04-19: Stabilisierung

Fertiggestellt:
- FERNET_KEY Persistenz-Fix (config.py + crypto.py)
  - crypto.py nutzt jetzt settings.FERNET_KEY direkt statt SHA256-Ableitung
  - Defensive isinstance-Check fuer str/bytes
  - .env.example bereinigt (keine echten E-Mail-Adressen)
  - Commit: f511aa2
- bookmark_count end-to-end
  - Model + Schema hatten bookmark_count schon
  - Scraper gefixt: nutzt AD_VIEWS Selektor + Regex "(\d+)\s*mal gemerkt"
  - Frontend zeigt Herz-Icon + Zahl
  - DB-Spalte per SQL manuell hinzugefuegt (Migration fehlt noch)
  - Verifiziert: 5 Listings mit bookmark_count > 0 nach Scrape
  - Commit: f66fb6d
- Session-Invalidierung + Re-Login fuer Account 4 erfolgreich
- LoginPage Duplicate-Links geprueft -- war schon sauber
- cli_login.py geprueft -- braucht keinen Fix (nutzt crypto.py upstream)
- MASTERPLAN.md erstellt (Gesamtplan fuer alle Agents)

Probleme die auftraten:
- Python-Inline-Script hat listings_page.py mit write(None) zerstoert -> git checkout Recovery
- sed-Escaping in zsh fehlgeschlagen -> komplette Datei per cat geschrieben
- docker compose up worker -> Service heisst scraper, nicht worker

### 2026-04-16: Session 3+4 -- Listings + Messages

Fertiggestellt:
- ListingsPage mit Filter, Suche, Sortierung
- ListingDetailModal + ListingEditModal
- MessagesPage (Inbox, Chat-View, Reply, 30s Polling)
- Alle Dispatcher-Handler
- Scraper-Fixes (Bilder, Preise, Views, Titel, Reihenfolge)

### 2026-04-16: Session 2 -- Scraper-Foundation

Fertiggestellt:
- selectors.py, BasePage, LoginPage, ListingsPage
- SessionManager, Dispatcher
- Frontend: AccountsPage mit Status-Badges

### 2026-04-16: Session 1 -- Foundation

Fertiggestellt:
- Docker Compose, Auth-Flow, DB-Schema, API-Skeleton, Frontend-Skeleton

## Notizen fuer naechsten Agenten

- Docker Service-Namen: backend, frontend, postgres, redis, scraper
- Dateien IMMER lesen vor Aenderung -- nie blind editieren
- Komplexe Dateiaenderungen: komplette Datei per cat schreiben
- Kein sed fuer mehrzeilige Aenderungen -- zu fragil in zsh
- Kimi nur Terminal-Befehle senden, kein Erklaerungstext
- GPT-Output auf Smart Quotes pruefen
- bookmark_count Selektor: gleiche DOM-Section wie view_count, Regex-basiert
- cli_login.py laeuft NUR auf dem Host (nicht in Docker), braucht GUI/DISPLAY

---

Naechste Tasks: Siehe MASTERPLAN.md Abschnitt 7 (Roadmap)
