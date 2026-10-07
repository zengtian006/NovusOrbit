"""
Base scraper with shared HTTP client logic and rate limiting.
"""

import asyncio
import logging
import re
from typing import Optional

import httpx
from markdownify import markdownify as md

from ..config import DEFAULT_HEADERS, REQUEST_DELAY_SECONDS, REQUEST_TIMEOUT_SECONDS, get_random_user_agent

logger = logging.getLogger(__name__)


def html_to_markdown(html_content: str) -> str:
    """
    Convert HTML job description to clean Markdown.

    Args:
        html_content: Raw HTML string (inner HTML of the description element)

    Returns:
        Clean Markdown string with proper formatting.
    """
    if not html_content:
        return ""

    try:
        # Convert HTML to Markdown
        result = md(
            html_content,
            heading_style="ATX",       # Use # headings
            bullets="-",               # Use - for lists
            strip=["img", "script", "style", "iframe"],  # Remove non-text elements
        )

        # Clean up excessive blank lines
        result = re.sub(r"\n{3,}", "\n\n", result)
        # Clean up leading/trailing whitespace on lines
        lines = [line.rstrip() for line in result.split("\n")]
        result = "\n".join(lines).strip()

        return result
    except Exception as e:
        logger.warning(f"HTML-to-Markdown conversion failed: {e}")
        # Fallback: strip HTML tags manually
        from bs4 import BeautifulSoup
        return BeautifulSoup(html_content, "html.parser").get_text(separator="\n", strip=True)


class BaseScraper:
    """Base class for all job board scrapers with shared HTTP logic."""

    def __init__(self):
        self._last_request_time: float = 0
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """
        Get or create a persistent HTTP client with cookie support.
        Using a persistent client allows cookies from an initial page visit
        to be sent on subsequent requests (important for anti-bot bypasses).
        """
        if self._client is None or self._client.is_closed:
            ua = get_random_user_agent()
            headers = {**DEFAULT_HEADERS, "User-Agent": ua}
            self._client = httpx.AsyncClient(
                timeout=REQUEST_TIMEOUT_SECONDS,
                follow_redirects=True,
                headers=headers,
            )
        return self._client

    async def close(self):
        """Close the persistent HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.close()

    async def _rate_limit(self):
        """Enforce rate limiting between requests."""
        now = asyncio.get_event_loop().time()
        elapsed = now - self._last_request_time
        if elapsed < REQUEST_DELAY_SECONDS:
            await asyncio.sleep(REQUEST_DELAY_SECONDS - elapsed)
        self._last_request_time = asyncio.get_event_loop().time()

    async def _get(
        self,
        url: str,
        params: Optional[dict] = None,
        headers: Optional[dict] = None,
    ) -> httpx.Response:
        """Make a rate-limited GET request using the persistent session."""
        await self._rate_limit()

        client = await self._get_client()

        try:
            response = await client.get(
                url, params=params, headers=headers or {}
            )
            response.raise_for_status()
            return response
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error {e.response.status_code} for {url}")
            raise
        except httpx.RequestError as e:
            logger.error(f"Request error for {url}: {e}")
            raise
