import asyncio
import logging
from typing import Iterable

from playwright.async_api import ElementHandle, Locator, Page, TimeoutError as PlaywrightTimeoutError


class BasePage:
	def __init__(self, page: Page, *, logger_name: str):
		self.page = page
		self.log = logging.getLogger(logger_name)

	async def wait_until_ready(self, timeout: int = 10000) -> None:
		await self.page.wait_for_load_state("domcontentloaded")
		await self.page.wait_for_selector("body", timeout=timeout)

	async def wait_for_selector_list(
		self,
		selectors: Iterable[str],
		*,
		timeout: int = 10000,
		strict: bool = False,
	) -> str:
		"""Wait for the first matching selector out of a fallback list.

		All selectors are tried in parallel so total wait time equals
		the timeout of a single selector, not timeout * len(selectors).
		"""
		selector_list = list(selectors)
		if not selector_list:
			raise ValueError("selectors must not be empty")

		if len(selector_list) == 1:
			await self.page.wait_for_selector(selector_list[0], timeout=timeout, state="attached")
			return selector_list[0]

		async def _try(sel: str) -> str:
			await self.page.wait_for_selector(sel, timeout=timeout, state="attached")
			return sel

		tasks: list[asyncio.Task[str]] = [
			asyncio.create_task(_try(sel)) for sel in selector_list
		]
		winner: str | None = None
		try:
			done, _ = await asyncio.wait(
				tasks,
				return_when=asyncio.FIRST_COMPLETED,
				timeout=timeout / 1000,
			)
			for task in done:
				if not task.cancelled() and task.exception() is None:
					winner = task.result()
					break
		finally:
			# Cancel all remaining tasks to avoid dangling background work
			for task in tasks:
				if not task.done():
					task.cancel()
			await asyncio.gather(*[t for t in tasks if not t.done()], return_exceptions=True)

		if winner is None:
			raise PlaywrightTimeoutError(
				f"None of the selectors matched within timeout: {selector_list}"
			)

		idx = selector_list.index(winner)
		if idx > 0:
			self.log.warning(
				"Selector fallback hit: %s (primary: %s)", winner, selector_list[0]
			)
		return winner

	async def try_selectors(
		self,
		root: Page | ElementHandle | Locator,
		selectors: Iterable[str],
		*,
		required: bool = False,
		log_missing: bool = False,
	) -> ElementHandle | None:
		selector_list = list(selectors)
		if not selector_list:
			raise ValueError("selectors must not be empty")

		for index, selector in enumerate(selector_list):
			handle = await root.query_selector(selector)
			if handle is not None:
				if index > 0:
					self.log.warning("Selector fallback hit: %s", selector)
				return handle

		if required:
			raise ValueError(f"No selector matched: {selector_list}")

		if log_missing:
			self.log.debug("No selector matched from cascade: %s", selector_list)

		return None

	async def try_text(
		self,
		root: Page | ElementHandle | Locator,
		selectors: Iterable[str],
		*,
		required: bool = False,
	) -> str | None:
		handle = await self.try_selectors(root, selectors, required=required)
		if handle is None:
			return None

		text = await handle.inner_text()
		return self.normalize_text(text)

	async def try_attribute(
		self,
		root: Page | ElementHandle | Locator,
		selectors_with_attributes: Iterable[tuple[str, str]],
		*,
		required: bool = False,
	) -> str | None:
		items = list(selectors_with_attributes)
		if not items:
			raise ValueError("selectors_with_attributes must not be empty")

		for index, (selector, attribute_name) in enumerate(items):
			handle = await root.query_selector(selector)
			if handle is None:
				continue

			value = await handle.get_attribute(attribute_name)
			if value:
				if index > 0:
					self.log.warning("Selector fallback hit: %s", selector)
				return value

		if required:
			raise ValueError(f"No selector/attribute matched: {items}")

		return None

	@staticmethod
	def normalize_text(value: str | None) -> str | None:
		if value is None:
			return None

		normalized = " ".join(value.split()).strip()
		return normalized or None