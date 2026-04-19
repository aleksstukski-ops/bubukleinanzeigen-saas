# Changelog

Alle relevanten Aenderungen am Projekt, chronologisch.

## 2026-04-19

### fix: FERNET_KEY Persistenz (f511aa2)
- `backend/app/core/config.py` — FERNET_KEY als required Setting
- `backend/app/core/crypto.py` — direkter Fernet-Key aus env, kein SHA256-Ableiten
- `.env.example` — bereinigt, keine echten E-Mail-Adressen
- Sessions invalidiert und Account 4 neu eingeloggt

### feat: bookmark_count scrapen (f66fb6d)
- `backend/app/scraper/pages/listings_page.py` — _extract_bookmark_count Methode
- Nutzt gleichen Selektor wie view_count (AD_VIEWS), Regex: `(\d+)\s*mal gemerkt`
- apply_listing_snapshot setzt bookmark_count
- Frontend zeigt Herz-Icon + Zahl

### docs: MASTERPLAN.md erstellt
- Gesamtplan fuer alle KI-Agenten
- Fehler-Katalog mit 7 dokumentierten Fehlern
- Roadmap mit 15 Tasks in 4 Phasen
- Notfall-Protokoll
- Validierungs-Checkliste

## 2026-04-16

### Sessions 1-4 komplett
- Auth-Flow (Register, Login, Refresh, Logout, Passwort vergessen)
- Kleinanzeigen-Accounts CRUD
- Job-Queue (DB + Redis, 3 Priority-Lanes)
- Scraper mit allen Handlern
- Frontend: Dashboard, Konten, Inserate, Nachrichten
- cli_login.py fuer Host-Login
- Deploy via Cloudflare Tunnel

### Scraper-Fixes
- Echte Bilder (srcset-Parsing)
- Preise (neuer Selektor)
- Views (neuer Selektor)
- Titel ("Anzeige "-Prefix entfernt)
- Reihenfolge (nach kleinanzeigen_id desc)
