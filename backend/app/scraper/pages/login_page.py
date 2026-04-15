from playwright.async_api import BrowserContext, Page

from app.scraper.pages.base import BasePage
from app.scraper.selectors import Selectors, UrlPatterns


class LoginPage(BasePage):
	def __init__(self, page: Page):
		super().__init__(page, logger_name="scraper.pages.login")

	async def open(self) -> None:
		await self.page.goto(UrlPatterns.LOGIN_URL, wait_until="domcontentloaded")
		await self.wait_until_ready()
		await self.wait_for_selector_list(Selectors.PAGE_READY)

	async def wait_for_manual_login_success(
		self,
		context: BrowserContext,
		*,
		timeout_seconds: int = 300,
		poll_interval_ms: int = 2000,
	) -> tuple[dict, str | None]:
		deadline = timeout_seconds * 1000
		elapsed = 0

		while elapsed < deadline:
			current_url = self.page.url
			if self._is_success_url(current_url):
				storage_state = await context.storage_state()
				user_name = await self.extract_user_name()
				return storage_state, user_name

			await self.page.wait_for_timeout(poll_interval_ms)
			elapsed += poll_interval_ms

		raise TimeoutError("Login-Timeout")

	async def extract_user_name(self) -> str | None:
		return await self.try_text(self.page, Selectors.LOGIN_USER_NAME)

	@staticmethod
	def _is_success_url(url: str) -> bool:
		return any(pattern in url for pattern in UrlPatterns.LOGIN_SUCCESS_PATTERNS)