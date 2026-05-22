# BubuBay Schlachtplan: Parallele Arbeit

## SPUR A: Codex (Terminal) — Backend/Scraper auf main
- A1: Selektoren DOM-Check (selectors.py, pages/*.py)
- A2: Nachrichten senden E2E (conversation_page.py, dispatcher.py)
- A3: Push bei neuer Nachricht (dispatcher.py, services/push.py)
- A4: CSV Import Backend (routers/listings.py)
- A5: Bulk-Preis Backend (routers/listings.py)

## SPUR B: Claude Code (Desktop) — Frontend auf Branch claude-code/frontend-upgrade
- B1: LandingPage Upgrade (LandingPage.jsx)
- B2: CSV Import Page (ImportPage.jsx NEU)
- B3: StatsPage (StatsPage.jsx NEU)
- B4: Onboarding verbessern (OnboardingWizard.jsx)
- B5: Mobile UX Polish (alle Pages CSS)

## Regeln
- Zwei Agents arbeiten NIE an der gleichen Datei
- Codex: main Branch, Backend + Scraper
- Claude Code: claude-code/frontend-upgrade Branch, nur Pages
- VERBOTEN fuer beide gleichzeitig: Layout.jsx, App.jsx, api.js, Modal.jsx
- Nach jeder Aufgabe: TASKBOARD.md aktualisieren
