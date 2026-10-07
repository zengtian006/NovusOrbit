"""
Job Search MCP Server

Exposes job search tools via the Model Context Protocol (MCP),
allowing AI assistants to search Indeed and LinkedIn for job listings.

Usage:
    python -m src.mcp.server
    # or
    python src/mcp/server.py
"""

import json
import logging
from typing import Optional

from mcp.server.fastmcp import FastMCP

from .config import DEFAULT_MAX_RESULTS, MAX_RESULTS_LIMIT
from .scrapers.indeed import IndeedScraper
from .scrapers.linkedin import LinkedInScraper

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Initialize MCP server and scrapers
# ---------------------------------------------------------------------------

mcp = FastMCP(
    "job-search",
    description=(
        "AI-powered job search tools. Search Indeed and LinkedIn "
        "for job listings, get detailed job descriptions, and compare "
        "opportunities — all through natural language."
    ),
)

indeed = IndeedScraper()
linkedin = LinkedInScraper()


# ---------------------------------------------------------------------------
# MCP Tools — Indeed
# ---------------------------------------------------------------------------


@mcp.tool()
async def search_indeed(
    query: str,
    location: str = "",
    max_results: int = DEFAULT_MAX_RESULTS,
    job_type: str = "",
    salary_min: str = "",
    sort: str = "relevance",
) -> str:
    """
    Search Indeed for job listings.

    Args:
        query: Job search keywords, e.g. "python developer", "data scientist"
        location: City/state/zip, e.g. "San Francisco, CA", "Remote"
        max_results: Number of results to return (default 10, max 50)
        job_type: Filter by type — "fulltime", "parttime", "contract", "internship"
        salary_min: Minimum salary filter, e.g. "$80000"
        sort: Sort order — "relevance" (default) or "date"

    Returns:
        JSON string with list of job listings including title, company,
        location, salary, snippet, and URL.
    """
    max_results = min(max_results, MAX_RESULTS_LIMIT)
    logger.info(f"Indeed search: query='{query}', location='{location}'")

    jobs = await indeed.search_jobs(
        query=query,
        location=location,
        max_results=max_results,
        job_type=job_type,
        salary_min=salary_min,
        sort=sort,
    )

    return json.dumps(jobs, indent=2, ensure_ascii=False)


@mcp.tool()
async def get_indeed_job_details(job_url: str) -> str:
    """
    Get full details for a specific Indeed job listing.

    Args:
        job_url: The full Indeed job URL (from search results)

    Returns:
        JSON string with full job description, requirements, company info, etc.
    """
    logger.info(f"Indeed job details: {job_url}")
    details = await indeed.get_job_details(job_url)
    return json.dumps(details, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# MCP Tools — LinkedIn
# ---------------------------------------------------------------------------


@mcp.tool()
async def search_linkedin(
    keywords: str,
    location: str = "",
    max_results: int = DEFAULT_MAX_RESULTS,
    job_type: str = "",
    experience_level: str = "",
    remote: str = "",
    sort_by: str = "relevance",
) -> str:
    """
    Search LinkedIn for public job postings (no login required).

    Args:
        keywords: Job search keywords, e.g. "machine learning engineer"
        location: Job location, e.g. "New York, NY"
        max_results: Number of results to return (default 10, max 50)
        job_type: Filter — F=Full-time, P=Part-time, C=Contract, T=Temporary, I=Internship
        experience_level: Filter — 1=Internship, 2=Entry, 3=Associate, 4=Mid-Senior, 5=Director, 6=Executive
        remote: Filter — 1=On-site, 2=Remote, 3=Hybrid
        sort_by: "relevance" (default) or "date"

    Returns:
        JSON string with list of job listings including title, company,
        location, date posted, and URL.
    """
    max_results = min(max_results, MAX_RESULTS_LIMIT)
    logger.info(f"LinkedIn search: keywords='{keywords}', location='{location}'")

    jobs = await linkedin.search_jobs(
        keywords=keywords,
        location=location,
        max_results=max_results,
        job_type=job_type,
        experience_level=experience_level,
        remote=remote,
        sort_by=sort_by,
    )

    return json.dumps(jobs, indent=2, ensure_ascii=False)


@mcp.tool()
async def get_linkedin_job_details(job_id_or_url: str) -> str:
    """
    Get full details for a specific LinkedIn job posting.

    Args:
        job_id_or_url: LinkedIn job ID (numeric) or full job URL from search results

    Returns:
        JSON string with full job description, seniority level,
        employment type, job function, and industries.
    """
    logger.info(f"LinkedIn job details: {job_id_or_url}")
    details = await linkedin.get_job_details(job_id_or_url)
    return json.dumps(details, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# MCP Tools — Cross-platform / Utility
# ---------------------------------------------------------------------------


@mcp.tool()
async def search_all_jobs(
    query: str,
    location: str = "",
    max_results_per_source: int = 5,
) -> str:
    """
    Search for jobs across ALL supported platforms (Indeed + LinkedIn)
    simultaneously and return combined results.

    Args:
        query: Job search keywords, e.g. "software engineer"
        location: Job location, e.g. "Austin, TX" or "Remote"
        max_results_per_source: Max results from each platform (default 5)

    Returns:
        JSON string with combined job listings from all sources,
        sorted with source labeled on each result.
    """
    import asyncio

    max_results_per_source = min(max_results_per_source, 25)
    logger.info(f"Multi-platform search: query='{query}', location='{location}'")

    # Run both searches in parallel
    indeed_task = indeed.search_jobs(
        query=query, location=location, max_results=max_results_per_source
    )
    linkedin_task = linkedin.search_jobs(
        keywords=query, location=location, max_results=max_results_per_source
    )

    indeed_results, linkedin_results = await asyncio.gather(
        indeed_task, linkedin_task, return_exceptions=True
    )

    all_jobs = []

    if isinstance(indeed_results, list):
        all_jobs.extend(indeed_results)
    else:
        all_jobs.append({"source": "Indeed", "error": str(indeed_results)})

    if isinstance(linkedin_results, list):
        all_jobs.extend(linkedin_results)
    else:
        all_jobs.append({"source": "LinkedIn", "error": str(linkedin_results)})

    return json.dumps(
        {
            "total_results": len(all_jobs),
            "sources": ["Indeed", "LinkedIn"],
            "jobs": all_jobs,
        },
        indent=2,
        ensure_ascii=False,
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    """Run the MCP server."""
    logger.info("Starting Job Search MCP Server...")
    mcp.run()


if __name__ == "__main__":
    main()
