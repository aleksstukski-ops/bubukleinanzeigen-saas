#!/usr/bin/env bash
# Kleinanzeigen-Login am Mac Mini (sichtbarer Browser).
#
# Der Docker-Scraper kann kein sichtbares Browserfenster oeffnen — der
# manuelle Login muss hier am Host laufen. Dieses Skript legt beim ersten
# Aufruf eine schlanke Python-Umgebung an und startet dann den Login.
#
#   scripts/login.sh Riri          # per Konto-Name
#   scripts/login.sh --account-id 16
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$ROOT/.venv-host"
PYTHON="${PYTHON:-python3.11}"

if [ ! -d "$VENV" ]; then
  echo "Richte einmalig die Login-Umgebung ein (dauert ~1 Minute)..."
  "$PYTHON" -m venv "$VENV"
  "$VENV/bin/pip" install --quiet --upgrade pip
  "$VENV/bin/pip" install --quiet "playwright==1.47.0" "cryptography==43.0.1" "asyncpg==0.29.0"
  # Browser fuer Playwright bereitstellen (nutzt vorhandenen Cache, laedt sonst nach)
  "$VENV/bin/python" -m playwright install chromium
fi

# Argumente durchreichen: entweder --account-id N / --label X, oder einfach der Name
if [ "$#" -eq 1 ] && [[ "$1" != --* ]]; then
  exec "$VENV/bin/python" "$ROOT/scripts/host_login.py" --label "$1"
fi
exec "$VENV/bin/python" "$ROOT/scripts/host_login.py" "$@"
