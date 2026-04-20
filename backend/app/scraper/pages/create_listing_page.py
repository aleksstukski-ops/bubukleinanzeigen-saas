import logging
from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError

from app.scraper.pages.base import BasePage
from app.scraper.selectors import Selectors, UrlPatterns

log = logging.getLogger("scraper.pages.create_listing")


class CreateListingPage(BasePage):
    def __init__(self, page: Page):
        super().__init__(page, logger_name="scraper.pages.create_listing")

    async def open(self, category_id: str | None = None) -> None:
        if category_id:
            url = UrlPatterns.CREATE_LISTING_WITH_CATEGORY_URL.format(category_id=category_id)
        else:
            url = UrlPatterns.CREATE_LISTING_URL
        await self.page.goto(url, wait_until="domcontentloaded")
        await self.wait_until_ready()

    async def create_listing(
        self,
        *,
        title: str,
        description: str | None = None,
        price: str | None = None,
        location: str | None = None,
    ) -> dict:
        """
        Fill in and submit the create-listing form.
        Selectors are best-guess — verify against live DOM if this fails.
        """
        # Title
        title_selector = await self.wait_for_selector_list(Selectors.CREATE_TITLE_INPUT, timeout=15000)
        await self._fill_input([title_selector], title)

        # Description
        if description:
            desc_selector = await self.wait_for_selector_list(Selectors.CREATE_DESCRIPTION_INPUT, timeout=10000)
            await self._fill_textarea([desc_selector], description)

        # Price (numeric part only)
        if price:
            numeric_price = "".join(c for c in price if c.isdigit() or c in ".,")
            try:
                price_selector = await self.wait_for_selector_list(Selectors.CREATE_PRICE_INPUT, timeout=5000)
                await self._fill_input([price_selector], numeric_price)
            except Exception:
                log.warning("Could not fill price field — skipping")

        # Submit
        submit_selector = await self.wait_for_selector_list(Selectors.CREATE_SUBMIT_BUTTON, timeout=10000)
        await self.page.click(submit_selector)

        # Wait for success or redirect
        try:
            await self.page.wait_for_load_state("networkidle", timeout=15000)
        except PlaywrightTimeoutError:
            log.warning("Timeout waiting for post-submit navigation")

        final_url = self.page.url
        log.info("Create listing submitted, final URL: %s", final_url)

        # Try to extract the new listing ID from the URL
        from app.scraper.selectors import LISTING_ID_REGEX
        match = LISTING_ID_REGEX.search(final_url)
        new_listing_id = match.group(1) if match else None

        return {
            "success": True,
            "url": final_url,
            "new_listing_id": new_listing_id,
        }
