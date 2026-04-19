import re
from datetime import datetime, timezone

from playwright.async_api import ElementHandle, Page

from app.models.domain import Listing
from app.scraper.pages.base import BasePage
from app.scraper.selectors import Selectors, UrlPatterns, extract_listing_id_from_href


class ListingsPage(BasePage):
	def __init__(self, page: Page):
		super().__init__(page, logger_name="scraper.pages.listings")

	async def open(self) -> None:
		await self.page.goto(UrlPatterns.MY_ADS_URL, wait_until="domcontentloaded")
		await self.wait_until_ready()
		await self.wait_for_selector_list(Selectors.AD_LIST_ITEM)

	async def scrape(self) -> list[dict]:
		item_selector = await self.wait_for_selector_list(Selectors.AD_LIST_ITEM)
		items = await self.page.query_selector_all(item_selector)
		listings: list[dict] = []

		for item in items:
			listing = await self.extract_listing(item)
			if listing is None:
				continue
			listings.append(listing)

		return listings

	async def extract_listing(self, item: ElementHandle) -> dict | None:
		link_handle = await self.try_selectors(item, Selectors.AD_LINK)
		if link_handle is None:
			self.log.warning("Skipping listing because no link selector matched")
			return None

		href = await link_handle.get_attribute("href")
		listing_id = extract_listing_id_from_href(href)
		if listing_id is None:
			self.log.warning("Skipping listing because no stable ID could be extracted from href=%s", href)
			return None

		title = await self.try_text(item, Selectors.AD_TITLE)
		if title and title.startswith("Anzeige "):
			title = title[len("Anzeige "):]

		price = await self.try_text(item, Selectors.AD_PRICE)
		image_url = await self._extract_image_url(item)
		view_count = await self._extract_view_count(item)
		absolute_url = self._to_absolute_url(href)

		return {
			"kleinanzeigen_id": listing_id,
			"title": title or "Ohne Titel",
			"price": price,
			"image_url": image_url,
			"view_count": view_count,
			"url": absolute_url,
		}

	async def _extract_image_url(self, item: ElementHandle) -> str | None:
		value = await self.try_attribute(item, Selectors.AD_IMAGE)
		if not value:
			return None
		# srcset format: "url1 1x, url2 2x" — take first URL only
		if "," in value:
			first_candidate = value.split(",")[0].strip()
		else:
			first_candidate = value.strip()
		# Remove size descriptor like "2x", "1x", "300w"
		if " " in first_candidate:
			return first_candidate.split(" ")[0].strip()
		return first_candidate

	async def _extract_view_count(self, item: ElementHandle) -> int | None:
		text = await self.try_text(item, Selectors.AD_VIEWS)
		if not text:
			return None

		match = re.search(r"(\d+)", text.replace(".", ""))
		if match is None:
			return None

		try:
			return int(match.group(1))
		except ValueError:
			return None

	@staticmethod
	def _to_absolute_url(href: str | None) -> str | None:
		if not href:
			return None
		if href.startswith("http://") or href.startswith("https://"):
			return href
		if href.startswith("/"):
			return f"https://www.kleinanzeigen.de{href}"
		return f"https://www.kleinanzeigen.de/{href.lstrip('/')}"

	@staticmethod
	def apply_listing_snapshot(
		existing_by_ka_id: dict[str, Listing],
		scraped_items: list[dict],
		*,
		account_id: int,
	) -> tuple[list[Listing], set[str]]:
		now = datetime.now(timezone.utc)
		seen_ids: set[str] = set()
		created_or_updated: list[Listing] = []

		for item in scraped_items:
			ka_id = item["kleinanzeigen_id"]
			seen_ids.add(ka_id)

			record = existing_by_ka_id.get(ka_id)
			if record is None:
				record = Listing(
					account_id=account_id,
					kleinanzeigen_id=ka_id,
					title=item["title"],
				)

			record.title = item["title"]
			record.price = item.get("price")
			record.image_url = item.get("image_url")
			record.view_count = item.get("view_count")
			record.url = item.get("url")
			record.is_active = True
			record.last_scraped_at = now
			created_or_updated.append(record)

		return created_or_updated, seen_ids