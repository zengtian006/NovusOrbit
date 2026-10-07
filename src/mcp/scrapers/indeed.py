"""
Indeed job board scraper with Google Jobs fallback.

Indeed aggressively blocks direct scraping (403). This module:
1. Tries Indeed directly with a session (homepage visit → cookie → search).
2. Falls back to Google Jobs search (`site:indeed.com`) if blocked.
"""

import json
import logging
import re
from typing import Optional
from urllib.parse import urljoin, quote_plus

from bs4 import BeautifulSoup

from ..config import (
    INDEED_BASE_URL,
    INDEED_SEARCH_URL,
    GOOGLE_SEARCH_URL,
)
from .base import BaseScraper, html_to_markdown

logger = logging.getLogger(__name__)


class IndeedScraper(BaseScraper):
    """Scraper for Indeed job listings with Google fallback."""

    _session_initialized: bool = False

    async def _ensure_session(self):
        """
        Visit the Indeed homepage once to obtain cookies/session tokens.
        This makes subsequent search requests look like real browser traffic.
        """
        if self._session_initialized:
            return
        try:
            await self._get(INDEED_BASE_URL)
            self._session_initialized = True
            logger.debug("Indeed session initialized via homepage visit")
        except Exception as e:
            logger.warning(f"Indeed homepage visit failed (will try search anyway): {e}")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def search_jobs(
        self,
        query: str,
        location: str = "",
        max_results: int = 10,
        job_type: str = "",
        salary_min: str = "",
        sort: str = "relevance",
    ) -> list[dict]:
        """
        Search Indeed for job listings.
        Falls back to Google if Indeed returns 403.

        Args:
            query: Job search keywords (e.g. "python developer")
            location: Job location (e.g. "San Francisco, CA")
            max_results: Maximum number of results to return
            job_type: Filter by job type (fulltime, parttime, contract, internship)
            salary_min: Minimum salary filter (e.g. "$80000")
            sort: Sort order - "relevance" or "date"

        Returns:
            List of job dictionaries with title, company, location, url, etc.
        """
        # --- Attempt 1: Direct Indeed ---
        try:
            await self._ensure_session()

            params = {
                "q": query,
                "l": location,
                "sort": sort,
                "limit": min(max_results, 50),
            }
            if job_type:
                params["jt"] = job_type
            if salary_min:
                params["salary"] = salary_min

            response = await self._get(
                INDEED_SEARCH_URL,
                params=params,
                headers={
                    "Referer": INDEED_BASE_URL + "/",
                    "Sec-Fetch-Site": "same-origin",
                },
            )
            results = self._parse_search_results(response.text, max_results)
            if results:
                return results
        except Exception as e:
            logger.warning(f"Direct Indeed search failed: {e}")

        # --- Attempt 2: Google Jobs fallback ---
        logger.info("Falling back to Google Jobs search for Indeed listings")
        try:
            return await self._search_via_google(query, location, max_results)
        except Exception as e:
            logger.error(f"Google fallback also failed: {e}")
            return [{"error": f"Indeed search failed (both direct and Google fallback): {str(e)}"}]

    async def get_job_details(self, job_url: str) -> dict:
        """
        Get detailed information about a specific Indeed job listing.

        Args:
            job_url: Full URL to the Indeed job posting

        Returns:
            Dictionary with full job details
        """
        try:
            await self._ensure_session()
            response = await self._get(
                job_url,
                headers={
                    "Referer": INDEED_SEARCH_URL,
                    "Sec-Fetch-Site": "same-origin",
                },
            )
            return self._parse_job_details(response.text, job_url)
        except Exception as e:
            logger.error(f"Indeed job details failed: {e}")
            return {"error": f"Failed to get job details: {str(e)}"}

    # ------------------------------------------------------------------
    # Google fallback
    # ------------------------------------------------------------------

    async def _search_via_google(
        self,
        query: str,
        location: str,
        max_results: int,
    ) -> list[dict]:
        """
        Search Google for Indeed job listings as a fallback.

        Uses `site:indeed.com/viewjob` to target actual job postings.
        """
        search_query = f"site:indeed.com/viewjob {query}"
        if location:
            search_query += f" {location}"

        params = {
            "q": search_query,
            "num": min(max_results, 20),
        }

        response = await self._get(
            GOOGLE_SEARCH_URL,
            params=params,
            headers={
                "Referer": "https://www.google.com/",
            },
        )

        return self._parse_google_results(response.text, max_results)

    def _parse_google_results(self, html: str, max_results: int) -> list[dict]:
        """Parse Google search results to extract Indeed job listings."""
        soup = BeautifulSoup(html, "html.parser")
        jobs = []

        for g in soup.select("div.g, div[data-hveid]"):
            try:
                link_el = g.select_one("a[href]")
                if not link_el:
                    continue
                href = link_el.get("href", "")
                if "indeed.com" not in href:
                    continue

                # Title: usually in the <h3> inside the link
                title_el = g.select_one("h3")
                raw_title = title_el.get_text(strip=True) if title_el else ""

                # Google titles for Indeed often look like:
                #   "Job Title - Company - City, ST - Indeed"
                # or "Job Title - Company | Indeed.com"
                title, company, location = self._parse_google_title(raw_title)

                # Snippet
                snippet_el = g.select_one(
                    ".VwiC3b, .IsZvec, [data-sncf], span.st"
                )
                snippet = snippet_el.get_text(strip=True) if snippet_el else ""

                if title and title != "N/A":
                    jobs.append({
                        "title": title,
                        "company": company,
                        "location": location,
                        "salary": "Not listed",
                        "snippet": snippet[:200],
                        "date_posted": "",
                        "url": href,
                        "source": "Indeed",
                    })

                if len(jobs) >= max_results:
                    break
            except Exception as e:
                logger.debug(f"Failed to parse Google result: {e}")
                continue

        return jobs

    @staticmethod
    def _parse_google_title(raw_title: str) -> tuple[str, str, str]:
        """
        Parse a Google result title like
        'Software Engineer - Acme Corp - San Francisco, CA - Indeed'
        into (title, company, location).
        """
        # Remove trailing " - Indeed", " | Indeed.com", etc.
        cleaned = re.sub(r"\s*[-|]\s*Indeed(?:\.com)?$", "", raw_title, flags=re.IGNORECASE).strip()

        parts = [p.strip() for p in cleaned.split(" - ")]
        if len(parts) >= 3:
            return parts[0], parts[1], parts[2]
        elif len(parts) == 2:
            return parts[0], parts[1], "N/A"
        else:
            return cleaned or "N/A", "N/A", "N/A"

    # ------------------------------------------------------------------
    # Indeed HTML parsers (unchanged logic, used when direct access works)
    # ------------------------------------------------------------------

    def _parse_search_results(self, html: str, max_results: int) -> list[dict]:
        """Parse Indeed search results HTML into structured data."""
        soup = BeautifulSoup(html, "html.parser")
        jobs = []

        # Indeed uses multiple card selectors depending on page version
        job_cards = soup.select(
            ".job_seen_beacon, .jobsearch-ResultsList > li, .result"
        )

        for card in job_cards[:max_results]:
            job = self._parse_job_card(card)
            if job and job.get("title") != "N/A":
                jobs.append(job)

        if not jobs:
            # Fallback: try to extract from script tags (Indeed sometimes
            # embeds job data as JSON in script elements)
            jobs = self._parse_from_scripts(soup, max_results)

        return jobs

    def _parse_job_card(self, card) -> Optional[dict]:
        """Parse a single Indeed job card element."""
        try:
            # Title
            title_el = card.select_one(
                "h2.jobTitle a, .jobTitle > a, a[data-jk], .job-title a"
            )
            title = title_el.get_text(strip=True) if title_el else "N/A"

            # URL
            url = "N/A"
            if title_el and title_el.get("href"):
                href = title_el["href"]
                url = href if href.startswith("http") else urljoin(INDEED_BASE_URL, href)

            # Company
            company_el = card.select_one(
                "[data-testid='company-name'], .companyName, .company"
            )
            company = company_el.get_text(strip=True) if company_el else "N/A"

            # Location
            location_el = card.select_one(
                "[data-testid='text-location'], .companyLocation, .location"
            )
            location = location_el.get_text(strip=True) if location_el else "N/A"

            # Salary (if shown)
            salary_el = card.select_one(
                ".salary-snippet-container, .salaryText, "
                "[data-testid='attribute_snippet_testid']"
            )
            salary = salary_el.get_text(strip=True) if salary_el else "Not listed"

            # Snippet / summary
            snippet_el = card.select_one(
                ".job-snippet, .summary, [data-testid='job-snippet']"
            )
            snippet = snippet_el.get_text(strip=True) if snippet_el else ""

            # Date posted
            date_el = card.select_one(".date, .posting-date, span.css-qvloho")
            date_posted = date_el.get_text(strip=True) if date_el else ""

            return {
                "title": title,
                "company": company,
                "location": location,
                "salary": salary,
                "snippet": snippet[:200] if snippet else "",
                "date_posted": date_posted,
                "url": url,
                "source": "Indeed",
            }
        except Exception as e:
            logger.debug(f"Failed to parse Indeed job card: {e}")
            return None

    def _parse_from_scripts(self, soup: BeautifulSoup, max_results: int) -> list[dict]:
        """Fallback: try to extract job data from embedded JSON scripts."""
        jobs = []
        for script in soup.select("script[type='application/ld+json']"):
            try:
                data = json.loads(script.string)
                if isinstance(data, dict) and data.get("@type") == "JobPosting":
                    jobs.append(self._normalize_ld_json(data))
                elif isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and item.get("@type") == "JobPosting":
                            jobs.append(self._normalize_ld_json(item))
            except (json.JSONDecodeError, TypeError):
                continue

        return jobs[:max_results]

    def _normalize_ld_json(self, data: dict) -> dict:
        """Convert JSON-LD JobPosting schema to our standard format."""
        org = data.get("hiringOrganization", {})
        loc = data.get("jobLocation", {})
        address = loc.get("address", {}) if isinstance(loc, dict) else {}

        salary_spec = data.get("baseSalary", {})
        salary = "Not listed"
        if salary_spec:
            value = salary_spec.get("value", {})
            if isinstance(value, dict):
                min_val = value.get("minValue", "")
                max_val = value.get("maxValue", "")
                unit = value.get("unitText", "")
                if min_val and max_val:
                    salary = f"${min_val:,} - ${max_val:,} {unit}"
                elif min_val:
                    salary = f"From ${min_val:,} {unit}"

        return {
            "title": data.get("title", "N/A"),
            "company": org.get("name", "N/A") if isinstance(org, dict) else str(org),
            "location": (
                f"{address.get('addressLocality', '')}, "
                f"{address.get('addressRegion', '')}"
            ).strip(", ") or "N/A",
            "salary": salary,
            "snippet": (data.get("description", ""))[:200],
            "date_posted": data.get("datePosted", ""),
            "url": data.get("url", "N/A"),
            "source": "Indeed",
        }

    def _parse_job_details(self, html: str, url: str) -> dict:
        """Parse a full Indeed job page."""
        soup = BeautifulSoup(html, "html.parser")

        # Try JSON-LD first (most reliable)
        for script in soup.select("script[type='application/ld+json']"):
            try:
                data = json.loads(script.string)
                if isinstance(data, dict) and data.get("@type") == "JobPosting":
                    result = self._normalize_ld_json(data)
                    # JSON-LD description is typically HTML; convert to Markdown
                    raw_desc = data.get("description", "")
                    result["full_description"] = html_to_markdown(raw_desc) if raw_desc else ""
                    result["employment_type"] = data.get("employmentType", "")
                    return result
            except Exception:
                continue

        # Fallback to HTML parsing
        title_el = soup.select_one(
            "h1.jobsearch-JobInfoHeader-title, .icl-u-xs-mb--xs h1"
        )
        desc_el = soup.select_one("#jobDescriptionText, .jobsearch-JobComponent-description")
        company_el = soup.select_one(
            "[data-testid='inlineHeader-companyName'], .icl-u-lg-mr--sm a"
        )
        location_el = soup.select_one(
            "[data-testid='inlineHeader-companyLocation'], "
            ".icl-u-xs-mt--xs .icl-u-textColor--secondary"
        )

        return {
            "title": title_el.get_text(strip=True) if title_el else "N/A",
            "company": company_el.get_text(strip=True) if company_el else "N/A",
            "location": location_el.get_text(strip=True) if location_el else "N/A",
            "full_description": html_to_markdown(str(desc_el)) if desc_el else "N/A",
            "url": url,
            "source": "Indeed",
        }
