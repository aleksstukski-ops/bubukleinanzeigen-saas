import asyncio
import logging
from datetime import datetime
from pathlib import Path

from playwright.async_api import Browser, BrowserContext, Page, Playwright, async_playwright

from app.core.config import settings

log = logging.getLogger("scraper.session_manager")


class SessionManager:
	def __init__(self):
		self._playwright: Playwright | None = None
		self._browsers: dict[bool, Browser] = {}
		self._pages: dict[tuple[int, bool], Page] = {}
		self._contexts: dict[tuple[int, bool], BrowserContext] = {}
		self._locks: dict[int, asyncio.Lock] = {}

	def lock(self, account_id: int) -> asyncio.Lock:
		if account_id not in self._locks:
			self._locks[account_id] = asyncio.Lock()
		return self._locks[account_id]

	async def get_page(
		self,
		account_id: int,
		*,
		headless: bool,
		storage_state: dict | str | None = None,
		force_new: bool = False,
	) -> Page:
		key = (account_id, headless)

		if force_new:
			await self.close_account(account_id, headless=headless)

		page = self._pages.get(key)
		if page is not None and not page.is_closed():
			return page

		browser = await self._get_browser(headless=headless)
		context = await self._create_context(browser, storage_state=storage_state)
		page = await context.new_page()

		self._contexts[key] = context
		self._pages[key] = page
		return page

	async def close_account(self, account_id: int, *, headless: bool | None = None) -> None:
		target_keys = []
		for key in list(self._contexts.keys()):
			key_account_id, key_headless = key
			if key_account_id != account_id:
				continue
			if headless is not None and key_headless != headless:
				continue
			target_keys.append(key)

		for key in target_keys:
			page = self._pages.pop(key, None)
			context = self._contexts.pop(key, None)

			if page is not None and not page.is_closed():
				try:
					await page.close()
				except Exception:
					log.exception("Error closing page for account %s", key[0])

			if context is not None:
				try:
					await context.close()
				except Exception:
					log.exception("Error closing context for account %s", key[0])

	async def capture_debug_snapshot(self, account_id: int, job_id: int) -> str | None:
		page = self._find_page_for_account(account_id)
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
		for key, page in list(self._pages.items()):
			try:
				if not page.is_closed():
					await page.close()
			except Exception:
				log.exception("Error closing page for account %s", key[0])

		for key, context in list(self._contexts.items()):
			try:
				await context.close()
			except Exception:
				log.exception("Error closing context for account %s", key[0])

		for headless, browser in list(self._browsers.items()):
			try:
				await browser.close()
			except Exception:
				log.exception("Error closing browser headless=%s", headless)

		if self._playwright is not None:
			try:
				await self._playwright.stop()
			except Exception:
				log.exception("Error stopping Playwright")

		self._pages.clear()
		self._contexts.clear()
		self._browsers.clear()
		self._playwright = None

	async def _get_browser(self, *, headless: bool) -> Browser:
		existing = self._browsers.get(headless)
		if existing is not None:
			return existing

		playwright = await self._get_playwright()
		browser = await playwright.chromium.launch(
			headless=headless,
			args=["--disable-dev-shm-usage"],
		)
		self._browsers[headless] = browser
		return browser

	async def _get_playwright(self) -> Playwright:
		if self._playwright is None:
			self._playwright = await async_playwright().start()
		return self._playwright

	async def _create_context(self, browser: Browser, *, storage_state: dict | str | None = None) -> BrowserContext:
		context_kwargs = {}
		if storage_state is not None:
			context_kwargs["storage_state"] = storage_state
		return await browser.new_context(**context_kwargs)

	def _find_page_for_account(self, account_id: int) -> Page | None:
		for (page_account_id, _), page in self._pages.items():
			if page_account_id == account_id and not page.is_closed():
				return page
		return None
