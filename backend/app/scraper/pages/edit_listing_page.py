from playwright.async_api import ElementHandle, Page, TimeoutError as PlaywrightTimeoutError

from app.scraper.pages.base import BasePage
from app.scraper.selectors import Selectors, UrlPatterns


class EditListingPage(BasePage):
    def __init__(self, page: Page):
        super().__init__(page, logger_name="scraper.pages.edit_listing")

    async def open(self, listing_id: str) -> None:
        await self.page.goto(
            UrlPatterns.EDIT_LISTING_URL_TEMPLATE.format(listing_id=listing_id),
            wait_until="domcontentloaded",
        )
        await self.wait_until_ready()
        await self.wait_for_edit_form()

    async def _wait_for_idle(self, timeout: int = 10000) -> None:
        """Bounded wait_for_load_state — Kleinanzeigen SPA never goes truly idle."""
        try:
            await self.page.wait_for_load_state("networkidle", timeout=timeout)
        except PlaywrightTimeoutError:
            self.log.debug("networkidle timeout, continuing")

    async def _find_listing_card(self, listing_id: str) -> ElementHandle | None:
        """Locate a single listing card on /m-meine-anzeigen.html by its KA id.

        Falls back through several wrapper conventions before giving up.
        Returns None when no scoping element can be found; callers may then
        fall back to page-wide selectors.
        """
        candidates = [
            f'article[data-adid="{listing_id}"]',
            f'[data-adid="{listing_id}"]',
            f'article:has(a[href*="/{listing_id}-"])',
            f'li:has(a[href*="/{listing_id}-"])',
        ]
        for selector in candidates:
            try:
                handle = await self.page.query_selector(selector)
            except Exception:
                handle = None
            if handle is not None:
                return handle
        return None

    async def _click_scoped(
        self,
        scope: ElementHandle | None,
        selectors: list[str],
    ) -> bool:
        """Click the first matching selector inside *scope*; falls back to page."""
        root = scope if scope is not None else self.page
        handle = await self.try_selectors(root, selectors)
        if handle is None:
            return False
        await handle.click()
        return True

    async def wait_for_edit_form(self) -> None:
        try:
            await self.wait_for_selector_list(Selectors.EDIT_FORM, timeout=10000)
        except PlaywrightTimeoutError:
            await self.wait_for_selector_list(Selectors.EDIT_TITLE_INPUT, timeout=10000)

    async def update_listing(
        self,
        *,
        title: str,
        price: str | None,
        description: str | None,
    ) -> dict:
        await self.wait_for_edit_form()

        await self._fill_input(Selectors.EDIT_TITLE_INPUT, title)
        await self._fill_input(Selectors.EDIT_PRICE_INPUT, price or "")
        await self._fill_textarea(Selectors.EDIT_DESCRIPTION_INPUT, description or "")

        submit_selector = await self.wait_for_selector_list(Selectors.EDIT_SUBMIT_BUTTON, timeout=10000)
        await self.page.click(submit_selector)

        await self._wait_after_submit()

        return {
            "success": True,
            "title": title,
            "price": price,
            "description": description,
            "url": self.page.url,
        }

    async def bump_listing(self, listing_id: str) -> dict:
        await self.page.goto(UrlPatterns.MY_ADS_URL, wait_until="domcontentloaded")
        await self.wait_until_ready()
        await self.wait_for_selector_list(Selectors.AD_LIST_ITEM)

        card = await self._find_listing_card(listing_id)
        if card is None:
            self.log.warning(
                "bump_listing: could not scope to card for %s, falling back to page-wide click",
                listing_id,
            )
        if not await self._click_scoped(card, Selectors.LISTING_BUMP_BUTTON):
            raise ValueError(f"Bump button not found for listing {listing_id}")

        await self._wait_for_idle()

        return {
            "success": True,
            "listing_id": listing_id,
            "url": self.page.url,
        }

    async def delete_listing(self, listing_id: str) -> dict:
        await self.page.goto(UrlPatterns.MY_ADS_URL, wait_until="domcontentloaded")
        await self.wait_until_ready()
        await self.wait_for_selector_list(Selectors.AD_LIST_ITEM)

        card = await self._find_listing_card(listing_id)
        if card is None:
            self.log.warning(
                "delete_listing: could not scope to card for %s, falling back to page-wide click",
                listing_id,
            )
        if not await self._click_scoped(card, Selectors.LISTING_DELETE_BUTTON):
            raise ValueError(f"Delete button not found for listing {listing_id}")

        # Confirmation dialog is page-level (modal), not inside the card
        confirm_selector = await self.wait_for_selector_list(
            Selectors.LISTING_DELETE_CONFIRM_BUTTON, timeout=10000
        )
        await self.page.click(confirm_selector)
        await self._wait_for_idle()

        return {
            "success": True,
            "listing_id": listing_id,
            "url": self.page.url,
        }

    async def _fill_input(self, selectors: list[str], value: str) -> None:
        handle = await self.try_selectors(self.page, selectors, required=True)
        await handle.click()
        await handle.fill("")
        await handle.fill(value)

    async def _fill_textarea(self, selectors: list[str], value: str) -> None:
        handle = await self.try_selectors(self.page, selectors, required=True)
        await handle.click()
        await handle.fill("")
        await handle.fill(value)

    async def _click_if_present(self, selectors: list[str]) -> bool:
        handle = await self.try_selectors(self.page, selectors)
        if handle is None:
            return False
        await handle.click()
        return True

    async def _wait_after_submit(self) -> None:
        try:
            success_selector = await self.wait_for_selector_list(Selectors.EDIT_SUCCESS_MARKER, timeout=8000)
            await self.page.wait_for_selector(success_selector, timeout=8000)
            return
        except PlaywrightTimeoutError:
            pass

        await self._wait_for_idle()
        await self.wait_until_ready()
