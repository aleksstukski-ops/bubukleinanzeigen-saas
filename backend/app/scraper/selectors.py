import re


LISTING_ID_REGEX = re.compile(r"/(\d{9,})-")


class Selectors:
    AD_LIST_ITEM = [
        "article.aditem",
        "[data-adid]",
        "li.ad-listitem",
    ]

    AD_LINK = [
        'a[href*="/s-anzeige/"]',
    ]

    AD_TITLE = [
        "h2 a",
        "a.ellipsis",
        '[class*="title"] a',
    ]

    AD_PRICE = [
        ".aditem-main--middle--price-shipping--price",
        '[class*="price"]',
    ]

    AD_IMAGE = [
        ("img[srcset]", "srcset"),
        ("img[data-srcset]", "data-srcset"),
        ("img[data-src]", "data-src"),
        ("img", "src"),
    ]

    AD_VIEWS = [
        '.aditem-main--bottom [class*="views"]',
        '[class*="counter-value"]',
    ]

    LOGGED_IN_MARKER = [
        'a[href*="/m-meine-anzeigen"]',
    ]

    LOGIN_REQUIRED_MARKER = [
        "form#login-form",
        'input[name="loginMail"]',
    ]

    LOGIN_USER_NAME = [
        '[data-testid="user-name"]',
        '[class*="user-name"]',
        '[class*="profile-name"]',
        'header a[href*="/m-profil.html"]',
    ]

    PAGE_READY = [
        "body",
    ]


class UrlPatterns:
    LOGIN_URL = "https://www.kleinanzeigen.de/m-einloggen.html"
    MY_ADS_URL = "https://www.kleinanzeigen.de/m-meine-anzeigen.html?tab=ADS"
    MY_ADS_BASE_URL = "https://www.kleinanzeigen.de/m-meine-anzeigen.html"

    LOGIN_SUCCESS_PATTERNS = [
        "/m-meine-anzeigen.html",
        "/m-meine-anzeigen/",
    ]

    LOGIN_REQUIRED_PATTERNS = [
        "/m-einloggen.html",
        "/login",
    ]


def extract_listing_id_from_href(href: str | None) -> str | None:
    if not href:
        return None

    match = LISTING_ID_REGEX.search(href)
    if match is None:
        return None

    return match.group(1)
