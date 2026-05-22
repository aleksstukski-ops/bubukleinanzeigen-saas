from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError

from app.scraper.pages.base import BasePage
from app.scraper.selectors import Selectors


class ListingDetailPage(BasePage):
    """VIP (View-Item-Page) on kleinanzeigen.de — public listing detail."""

    def __init__(self, page: Page):
        super().__init__(page, logger_name="scraper.pages.listing_detail")

    async def open(self, url: str) -> None:
        await self.page.goto(url, wait_until="domcontentloaded")
        await self.wait_until_ready()

    async def extract_description(self) -> str | None:
        try:
            selector = await self.wait_for_selector_list(Selectors.VIP_DESCRIPTION, timeout=8000)
        except PlaywrightTimeoutError:
            return None

        handle = await self.page.query_selector(selector)
        if handle is None:
            return None

        # innerText preserves line breaks; textContent collapses them.
        text = await handle.inner_text()
        if text is None:
            return None
        stripped = text.strip()
        return stripped or None
