"""
LinkedIn job board scraper (public/guest endpoints only — no auth required).
"""

import logging
import re
from typing import Optional

from bs4 import BeautifulSoup

from ..config import LINKEDIN_JOBS_API, LINKEDIN_JOB_DETAIL_URL
from .base import BaseScraper, html_to_markdown

logger = logging.getLogger(__name__)


class LinkedInScraper(BaseScraper):
    """Scraper for LinkedIn public job listings (guest API, no login needed)."""

    async def search_jobs(
        self,
        keywords: str,
        location: str = "",
        max_results: int = 10,
        job_type: str = "",
        experience_level: str = "",
        remote: str = "",
        sort_by: str = "relevance",
    ) -> list[dict]:
        """
        Search LinkedIn for public job postings.

        Args:
            keywords: Job search keywords (e.g. "machine learning engineer")
            location: Job location (e.g. "New York, NY")
            max_results: Maximum number of results to return
            job_type: Filter: F=Full-time, P=Part-time, C=Contract, T=Temporary, I=Internship
            experience_level: Filter: 1=Internship, 2=Entry, 3=Associate, 4=Mid-Senior, 5=Director, 6=Executive
            remote: Filter: 1=On-site, 2=Remote, 3=Hybrid
            sort_by: "relevance" or "date" (R or DD)

        Returns:
            List of job dictionaries
        """
        params = {
            "keywords": keywords,
            "location": location,
            "start": 0,
            "sortBy": "DD" if sort_by == "date" else "R",
        }

        if job_type:
            params["f_JT"] = job_type
        if experience_level:
            params["f_E"] = experience_level
        if remote:
            params["f_WT"] = remote

        all_jobs = []
        page_size = 25  # LinkedIn returns 25 per page

        while len(all_jobs) < max_results:
            params["start"] = len(all_jobs)
            try:
                response = await self._get(LINKEDIN_JOBS_API, params=params)
                page_jobs = self._parse_search_results(response.text)

                if not page_jobs:
                    break

                all_jobs.extend(page_jobs)

                if len(page_jobs) < page_size:
                    break  # Last page

            except Exception as e:
                logger.error(f"LinkedIn search failed at offset {len(all_jobs)}: {e}")
                if not all_jobs:
                    return [{"error": f"LinkedIn search failed: {str(e)}"}]
                break

        return all_jobs[:max_results]

    def _parse_search_results(self, html: str) -> list[dict]:
        """Parse LinkedIn guest jobs API HTML response."""
        soup = BeautifulSoup(html, "html.parser")
        jobs = []

        for card in soup.select(".base-card, .job-search-card"):
            job = self._parse_job_card(card)
            if job:
                jobs.append(job)

        return jobs

    def _parse_job_card(self, card) -> Optional[dict]:
        """Parse a single LinkedIn job card."""
        try:
            # Title
            title_el = card.select_one(
                ".base-search-card__title, .job-search-card__title"
            )
            title = title_el.get_text(strip=True) if title_el else "N/A"

            # Company
            company_el = card.select_one(
                ".base-search-card__subtitle a, "
                ".job-search-card__company-name"
            )
            company = company_el.get_text(strip=True) if company_el else "N/A"

            # Location
            location_el = card.select_one(
                ".job-search-card__location, "
                ".base-search-card__metadata span"
            )
            location = location_el.get_text(strip=True) if location_el else "N/A"

            # URL
            link_el = card.select_one(
                "a.base-card__full-link, a.base-search-card__full-link"
            )
            url = link_el["href"].split("?")[0] if link_el and link_el.get("href") else "N/A"

            # Date posted
            date_el = card.select_one(
                "time, .job-search-card__listdate, "
                ".base-search-card__listdate"
            )
            date_posted = ""
            if date_el:
                date_posted = date_el.get("datetime", "") or date_el.get_text(strip=True)

            # Job ID (for detail fetching)
            job_id = ""
            data_entity = card.get("data-entity-urn", "")
            if data_entity:
                job_id = data_entity.split(":")[-1]

            return {
                "title": title,
                "company": company,
                "location": location,
                "date_posted": date_posted,
                "url": url,
                "job_id": job_id,
                "source": "LinkedIn",
            }
        except Exception as e:
            logger.debug(f"Failed to parse LinkedIn job card: {e}")
            return None

    async def get_job_details(self, job_id_or_url: str) -> dict:
        """
        Get detailed information about a specific LinkedIn job posting.

        Args:
            job_id_or_url: LinkedIn job ID (numeric) or full job URL

        Returns:
            Dictionary with full job details
        """
        # Extract job ID if a URL was provided
        job_id = job_id_or_url
        if "/" in job_id_or_url:
            # Try to extract ID from URL like /jobs/view/1234567890/
            # or /jobs/view/job-title-slug-1234567890
            parts = job_id_or_url.rstrip("/").split("/")
            for part in reversed(parts):
                if part.isdigit():
                    job_id = part
                    break
                # Handle slug-style: "aws-cloud-architect-at-company-4232971030"
                # Extract trailing numeric ID after the last hyphen
                trailing_id = re.search(r"-(\d{7,})$", part)
                if trailing_id:
                    job_id = trailing_id.group(1)
                    break

        url = f"{LINKEDIN_JOB_DETAIL_URL}/{job_id}"

        try:
            response = await self._get(url)
            return self._parse_job_details(response.text, job_id_or_url)
        except Exception as e:
            logger.error(f"LinkedIn job detail fetch failed: {e}")
            return {"error": f"Failed to get job details: {str(e)}"}

    def _parse_job_details(self, html: str, original_url: str) -> dict:
        """Parse a LinkedIn job detail page."""
        soup = BeautifulSoup(html, "html.parser")

        # Title
        title_el = soup.select_one(
            ".top-card-layout__title, h1, .topcard__title"
        )
        title = title_el.get_text(strip=True) if title_el else "N/A"

        # Company
        company_el = soup.select_one(
            ".topcard__org-name-link, .top-card-layout__company-name, "
            "a[data-tracking-control-name='public_jobs_topcard-org-name']"
        )
        company = company_el.get_text(strip=True) if company_el else "N/A"

        # Location
        location_el = soup.select_one(
            ".topcard__flavor--bullet, .top-card-layout__bullet"
        )
        location = location_el.get_text(strip=True) if location_el else "N/A"

        # Full description — convert HTML to Markdown to preserve formatting
        desc_el = soup.select_one(
            ".show-more-less-html__markup, .description__text, "
            ".core-section-container__content"
        )
        description = html_to_markdown(str(desc_el)) if desc_el else "N/A"

        # Criteria (seniority, employment type, etc.)
        criteria = {}
        for item in soup.select(".description__job-criteria-item"):
            header_el = item.select_one(".description__job-criteria-subheader")
            value_el = item.select_one(".description__job-criteria-text")
            if header_el and value_el:
                key = header_el.get_text(strip=True).lower().replace(" ", "_")
                criteria[key] = value_el.get_text(strip=True)

        return {
            "title": title,
            "company": company,
            "location": location,
            "full_description": description,
            "seniority_level": criteria.get("seniority_level", ""),
            "employment_type": criteria.get("employment_type", ""),
            "job_function": criteria.get("job_function", ""),
            "industries": criteria.get("industries", ""),
            "url": original_url,
            "source": "LinkedIn",
        }
