# Cloudflare Setup — bububay.de

Stand: 2026-05-21

Diese Schritte muessen manuell im Cloudflare Dashboard erledigt werden.
Claude Code hat keinen Dashboard-Zugriff.

---

## 1. DNS Records pruefen (bububay.de Zone)

Dashboard → bububay.de → DNS → Records.

Erforderliche Records (alle proxied / orange wolke):

| Type  | Name           | Target                                    | Proxy | Zweck                      |
|-------|----------------|-------------------------------------------|-------|----------------------------|
| CNAME | bububay.de     | `<tunnel-id>.cfargotunnel.com`            | proxied | Root-Domain auf Tunnel  |
| CNAME | www            | `<tunnel-id>.cfargotunnel.com`            | proxied | www auf Tunnel          |
| CNAME | api            | `<tunnel-id>.cfargotunnel.com`            | proxied | API-Subdomain           |

`<tunnel-id>` ist die UUID des bububay-Tunnels. Steht in `~/.cloudflared/<id>.json` auf dem Mac Mini.

**Status laut `curl -sI`:**
- bububay.de → 301 zu www.bububay.de (OK)
- www.bububay.de → noch nicht getestet (sollte 200 liefern)
- api.bububay.de → 200 (OK, Route existiert bereits)

---

## 2. Tunnel-Route fuer api.bububay.de

Dashboard → Zero Trust → Networks → Tunnels → bububay (oder Name des Tunnels).

Pruefen ob Route fuer `api.bububay.de` existiert. Falls nicht:

1. Auf Tunnel klicken → "Public Hostnames" Tab
2. "Add a public hostname":
   - Subdomain: `api`
   - Domain: `bububay.de`
   - Path: leer
   - Service: HTTP → `http://localhost:8000`
3. Speichern.

**Falls noch nicht im Backend CORS erlaubt:** in `backend/app/main.py` die `CORS_ALLOW_ORIGINS` Env-Variable erweitern um `https://bububay.de,https://www.bububay.de` und Backend neustarten.

---

## 3. bubuanzeigen.de → bububay.de 301-Redirect

Dashboard → bubuanzeigen.de → Rules → Redirect Rules → "Create rule".

Konfiguration:

- **Rule name:** `Redirect old domain to bububay.de`
- **When incoming requests match:** Custom filter expression
  - Field: Hostname
  - Operator: equals
  - Value: `bubuanzeigen.de` (und zweite Bedingung fuer `www.bubuanzeigen.de` per OR)
- **Then:**
  - Type: Dynamic
  - Expression: `concat("https://bububay.de", http.request.uri.path)`
  - Status code: 301
  - Preserve query string: enabled

Speichern → Deploy.

Test danach: `curl -sI https://bubuanzeigen.de/inserate` → sollte `301` mit `location: https://bububay.de/inserate` liefern.

---

## 4. Validierung nach Setup

```bash
curl -sI https://bububay.de | head -5
curl -sI https://www.bububay.de | head -5
curl -sI https://api.bububay.de/healthz | head -5     # erwartet 200
curl -sI https://bubuanzeigen.de/test | head -5       # erwartet 301
```

Falls ein Punkt fehlschlaegt: Cloudflare DNS-Cache kann bis zu 5min brauchen.

---

## Notfall

- DNS kaputt: alle Records pruefen, Tunnel-UUID in `~/.cloudflared/config.yml` vergleichen.
- Tunnel down: `launchctl list | grep com.bububay.tunnel` (sollte laufen). Bei Bedarf: `launchctl kickstart -k gui/$(id -u)/com.bububay.tunnel`.
- Redirect-Loop: in Redirect-Rule Bedingung pruefen, sie darf nicht auf bububay.de matchen.
