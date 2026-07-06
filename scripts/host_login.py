#!/usr/bin/env python3
"""Standalone Kleinanzeigen login for the host machine (Mac Mini).

The Dockerized scraper cannot open a visible browser (no display), so the
manual login — where a human types the email/password and solves any captcha —
must run here, on the machine with a screen. This script opens a real Chromium
window, waits for you to finish logging in, then encrypts the browser session
in the exact same format the Docker scraper reads (Fernet over storage_state
JSON) and writes it straight into the database.

Deliberately standalone: it depends only on playwright, cryptography and
asyncpg, and reads FERNET_KEY + DATABASE_URL from the project .env — so it does
not need the full backend app installed on the host.

Usage (via scripts/login.sh, which sets up the venv):
    python scripts/host_login.py --account-id 16
    python scripts/host_login.py --label Riri
"""
import argparse
import asyncio
import json
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import asyncpg
from cryptography.fernet import Fernet
from playwright.async_api import async_playwright


def _find_chrome() -> str | None:
    candidates = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ]
    for path in candidates:
        if Path(path).exists():
            return path
    return None

LOGIN_URL = "https://www.kleinanzeigen.de/m-einloggen.html"
MY_ADS_BASE_URL = "https://www.kleinanzeigen.de/m-meine-anzeigen.html"
LOGIN_SUCCESS_PATTERNS = ["/m-meine-anzeigen.html", "/m-meine-anzeigen/"]
BLOCK_MARKERS = (
    "ip-bereich",
    "voruebergehend gesperrt",
    "vorübergehend gesperrt",
    "zur vorbeugung von betrug",
    "zeitweilig von der nutzung",
)


def clear_scraper_pause(redis_url: str) -> None:
    """Best-effort: after a successful login the IP works again, so lift any
    block cooldown the scraper set. Never fails the login if Redis is down."""
    try:
        import redis  # optional dependency

        host_url = redis_url.replace("redis://redis:", "redis://localhost:")
        client = redis.from_url(host_url)
        client.delete("scraper:paused_until", "scraper:block_count")
        client.close()
    except Exception:
        pass

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def to_host_dsn(database_url: str) -> str:
    """Turn the app's async SQLAlchemy URL into a plain asyncpg DSN reachable
    from the host: drop the +asyncpg driver suffix and rewrite the Docker
    service hostname to localhost (postgres is published on 5432)."""
    dsn = database_url.replace("postgresql+asyncpg://", "postgresql://")
    dsn = dsn.replace("@postgres:", "@localhost:")
    return dsn


async def resolve_account(conn, account_id: int | None, label: str | None):
    if account_id is not None:
        return await conn.fetchrow(
            "SELECT id, label, status FROM kleinanzeigen_accounts WHERE id = $1", account_id
        )
    rows = await conn.fetch(
        "SELECT id, label, status FROM kleinanzeigen_accounts WHERE lower(label) = lower($1)", label
    )
    if len(rows) > 1:
        print(f"Mehrere Konten heissen '{label}':", flush=True)
        for row in rows:
            print(f"  id={row['id']}  status={row['status']}", flush=True)
        print("Bitte --account-id <ID> verwenden.", flush=True)
        return None
    return rows[0] if rows else None


async def run(account_id: int | None, label: str | None) -> int:
    env = load_env(PROJECT_ROOT / ".env")
    fernet_key = env.get("FERNET_KEY")
    database_url = env.get("DATABASE_URL")
    if not fernet_key or not database_url:
        print("FEHLER: FERNET_KEY oder DATABASE_URL fehlt in .env", flush=True)
        return 1

    fernet = Fernet(fernet_key.encode())
    conn = await asyncpg.connect(to_host_dsn(database_url))
    try:
        account = await resolve_account(conn, account_id, label)
        if account is None:
            print("Konto nicht gefunden.", flush=True)
            return 1

        acc_id = account["id"]
        print(f"\n=== Login fuer Konto '{account['label']}' (id={acc_id}) ===", flush=True)
        print("Ein Browserfenster oeffnet sich. Melde dich dort bei Kleinanzeigen an.", flush=True)
        print("Sobald du auf 'Meine Anzeigen' landest, wird die Sitzung gespeichert.\n", flush=True)

        # Start the REAL Google Chrome as a normal subprocess (NOT launched by
        # Playwright, so it carries no automation flags — navigator.webdriver
        # stays false and Akamai Bot Manager sees a genuine human browser).
        # Playwright then only *connects* over CDP to read the session after
        # the user has logged in by hand.
        chrome_bin = _find_chrome()
        if not chrome_bin:
            print("Google Chrome nicht gefunden. Bitte Google Chrome installieren.", flush=True)
            return 1

        profile_dir = str(PROJECT_ROOT / ".chrome-login-profile")
        debug_port = 9222
        chrome_proc = subprocess.Popen(
            [
                chrome_bin,
                f"--remote-debugging-port={debug_port}",
                f"--user-data-dir={profile_dir}",
                "--no-first-run",
                "--no-default-browser-check",
                "--new-window",
                LOGIN_URL,
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        try:
            # Wait for the CDP endpoint to come up.
            cdp_ready = False
            for _ in range(40):
                try:
                    urllib.request.urlopen(f"http://localhost:{debug_port}/json/version", timeout=1)
                    cdp_ready = True
                    break
                except Exception:
                    await asyncio.sleep(0.5)
            if not cdp_ready:
                print("Chrome liess sich nicht mit Debug-Port starten.", flush=True)
                return 1

            async with async_playwright() as pw:
                browser = await pw.chromium.connect_over_cdp(f"http://localhost:{debug_port}")

                def all_pages():
                    pages = []
                    for ctx in browser.contexts:
                        pages.extend(ctx.pages)
                    return pages

                deadline = 1800  # 30 minutes
                elapsed = 0
                success = False
                success_ctx = None
                saw_login_domain = False
                while elapsed < deadline:
                    pages = all_pages()
                    for pg in pages:
                        try:
                            url = pg.url
                        except Exception:
                            continue
                        # Explicit success: the "Meine Anzeigen" member page.
                        if any(p in url for p in LOGIN_SUCCESS_PATTERNS):
                            success = True
                            success_ctx = pg.context
                            break
                        # Track that the user reached the Auth0/SSO login flow.
                        if "login.kleinanzeigen.de" in url:
                            saw_login_domain = True
                        # Forgiving success: after the login flow, the user is
                        # redirected back to the main site — that means they are
                        # logged in even if they never click "Meine Anzeigen".
                        if (
                            saw_login_domain
                            and "www.kleinanzeigen.de" in url
                            and "einloggen" not in url
                            and "/login" not in url
                        ):
                            success = True
                            success_ctx = pg.context
                            break
                        # Block detection on KA pages.
                        if "kleinanzeigen.de" in url:
                            try:
                                content = (await pg.content()).lower()
                            except Exception:
                                content = ""
                            if any(m in content for m in BLOCK_MARKERS):
                                print(
                                    "\nKleinanzeigen zeigt die Sperrseite (Akamai Bot-Schutz).\n"
                                    "Warte 15-30 Minuten und starte erneut. Lass Kleinanzeigen\n"
                                    "in der Zwischenzeit in Ruhe (kein wiederholtes Aufrufen).\n",
                                    flush=True,
                                )
                                return 3
                    if success:
                        break
                    if elapsed % 60 == 0 and elapsed > 0:
                        print(f"...warte auf Login ({elapsed//60} von 30 Min)", flush=True)
                    await asyncio.sleep(2)
                    elapsed += 2

                if not success:
                    print(
                        "Zeitueberschreitung (30 Min): Login nicht erkannt. Melde dich im\n"
                        "Chrome-Fenster an und starte danach erneut.",
                        flush=True,
                    )
                    return 2

                storage_state = await (success_ctx or browser.contexts[0]).storage_state()
                await browser.close()
        finally:
            try:
                chrome_proc.terminate()
            except Exception:
                pass

        payload = json.dumps(storage_state, ensure_ascii=False, separators=(",", ":"))
        encrypted = fernet.encrypt(payload.encode()).decode()
        now = datetime.now(timezone.utc)
        await conn.execute(
            """
            UPDATE kleinanzeigen_accounts
            SET session_encrypted = $1,
                status = 'active',
                last_error = NULL,
                session_updated_at = $2
            WHERE id = $3
            """,
            encrypted, now, acc_id,
        )
        # The IP works again — lift any block cooldown the scraper set.
        clear_scraper_pause(env.get("REDIS_URL", "redis://localhost:6379/0"))
        print(f"\nErfolg! Konto '{account['label']}' ist jetzt verbunden (status=active).", flush=True)
        print("Der Scraper nutzt die Sitzung ab sofort automatisch.", flush=True)
        return 0
    finally:
        await conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Kleinanzeigen-Login am Host (sichtbarer Browser)")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--account-id", type=int, help="ID des Kontos")
    group.add_argument("--label", type=str, help="Name/Label des Kontos, z. B. Riri")
    args = parser.parse_args()
    return asyncio.run(run(args.account_id, args.label))


if __name__ == "__main__":
    sys.exit(main())
