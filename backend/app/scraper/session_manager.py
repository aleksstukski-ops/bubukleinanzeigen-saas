import asyncio
import logging
from datetime import datetime
from pathlib import Path
from app.core.config import settings

log = logging.getLogger("scraper.session_manager")


class SessionManager:
    def __init__(self):
        self._playwright = None
        self._browser = None
        self._pages = {}
        self._contexts = {}
        self._locks = {}

    def lock(self, account_id: int) -> asyncio.Lock:
        if account_id not in self._locks:
            self._locks[account_id] = asyncio.Lock()
        return self._locks[account_id]

    async def capture_debug_snapshot(self, account_id: int, job_id: int) -> str | None:
        page = self._pages.get(account_id)
        if page is None:
            return None
        try:
            debug_dir = Path(settings.SCRAPER_SESSION_DIR).parent / "debug"
            debug_dir.mkdir(parents=True, exist_ok=True)
            ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            png_path = debug_dir / f"job_{job_id}_{ts}.png"
            html_path = debug_dir / f"job_{job_id}_{ts}.html"
            await page.screenshot(path=str(png_path), full_page=True)
            html = await page.content()
            html_path.write_text(html, encoding="utf-8")
            return str(png_path)
        except Exception:
            log.exception("capture_debug_snapshot failed for account %s", account_id)
            return None

    async def close_all(self) -> None:
        for account_id, context in list(self._contexts.items()):
            try:
                await context.close()
            except Exception:
                log.exception("Error closing context for account %s", account_id)
        if self._browser is not None:
            try:
                await self._browser.close()
            except Exception:
                log.exception("Error closing browser")
        if self._playwright is not None:
            try:
                await self._playwright.stop()
            except Exception:
                log.exception("Error stopping Playwright")
        self._pages.clear()
        self._contexts.clear()
