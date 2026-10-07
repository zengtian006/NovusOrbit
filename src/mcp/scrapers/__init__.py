"""
Job board scrapers for the MCP server.
"""

from .indeed import IndeedScraper
from .linkedin import LinkedInScraper

__all__ = ["IndeedScraper", "LinkedInScraper"]
