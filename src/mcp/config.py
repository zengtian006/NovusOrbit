"""
Configuration constants for the Job Search MCP server.
"""

import random

# Rotate User-Agent strings to reduce fingerprinting
_USER_AGENTS = [
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/17.4 Safari/605.1.15"
    ),
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) "
        "Gecko/20100101 Firefox/125.0"
    ),
]


def get_random_user_agent() -> str:
    return random.choice(_USER_AGENTS)


# Default headers to mimic a browser request
DEFAULT_HEADERS = {
    "User-Agent": get_random_user_agent(),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
}

# Rate limiting
REQUEST_DELAY_SECONDS = 2.0  # Slightly longer delay to be safer
REQUEST_TIMEOUT_SECONDS = 30

# Default search settings
DEFAULT_MAX_RESULTS = 10
MAX_RESULTS_LIMIT = 50

# Indeed
INDEED_BASE_URL = "https://www.indeed.com"
INDEED_SEARCH_URL = f"{INDEED_BASE_URL}/jobs"

# LinkedIn
LINKEDIN_BASE_URL = "https://www.linkedin.com"
LINKEDIN_JOBS_API = f"{LINKEDIN_BASE_URL}/jobs-guest/jobs/api/seeMoreJobPostings/search"
LINKEDIN_JOB_DETAIL_URL = f"{LINKEDIN_BASE_URL}/jobs-guest/jobs/api/jobPosting"

# Google Jobs fallback (for when Indeed blocks direct access)
GOOGLE_SEARCH_URL = "https://www.google.com/search"
