from playwright.async_api import Page, TimeoutError as PlaywrightTimeoutError

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

        if not await self._click_if_present(Selectors.LISTING_BUMP_BUTTON):
            raise ValueError(f"Bump button not found for listing {listing_id}")

        await self.page.wait_for_load_state("networkidle")

        return {
            "success": True,
            "listing_id": listing_id,
            "url": self.page.url,
        }

    async def delete_listing(self, listing_id: str) -> dict:
        await self.page.goto(UrlPatterns.MY_ADS_URL, wait_until="domcontentloaded")
        await self.wait_until_ready()

        if not await self._click_if_present(Selectors.LISTING_DELETE_BUTTON):
            raise ValueError(f"Delete button not found for listing {listing_id}")

        confirm_selector = await self.wait_for_selector_list(Selectors.LISTING_DELETE_CONFIRM_BUTTON, timeout=10000)
        await self.page.click(confirm_selector)
        await self.page.wait_for_load_state("networkidle")

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

        await self.page.wait_for_load_state("networkidle")
        await self.wait_until_ready()
