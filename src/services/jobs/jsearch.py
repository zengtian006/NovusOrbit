"""
JSearch job search client (OpenWeb Ninja, sold through RapidAPI).

JSearch aggregates Google for Jobs, which covers LinkedIn, Indeed, Glassdoor,
ZipRecruiter and company career sites, and returns full job descriptions and
apply links. It is the primary job source for Job Suggestions; the Indeed and
LinkedIn scrapers in src/mcp/scrapers are only a fallback.

Environment:
    JSEARCH_API_KEY      RapidAPI key with a JSearch subscription (required to enable)
    JSEARCH_API_HOST     default "jsearch.p.rapidapi.com"
    JSEARCH_CACHE_TTL    seconds to cache identical searches, default 3600
    JSEARCH_TIMEOUT      request timeout in seconds, default 20
"""

from __future__ import annotations

from datetime import datetime
import os
import time
from typing import Any, Optional

import httpx

from src.logging import get_logger

logger = get_logger("JSearch")

DATE_POSTED_VALUES = {"all", "today", "3days", "week", "month"}


class JSearchError(Exception):
    """Raised when JSearch can't be used for this request (not configured, quota, HTTP error)."""


def is_configured() -> bool:
    return bool(os.getenv("JSEARCH_API_KEY", "").strip())


def _cache_ttl() -> int:
    try:
        return max(0, int(os.getenv("JSEARCH_CACHE_TTL", "3600")))
    except ValueError:
        return 3600


# key -> (expires_at, jobs)
_cache: dict[tuple, tuple[float, list[dict]]] = {}


def clear_cache() -> None:
    _cache.clear()


def _format_salary(job: dict) -> str:
    lo, hi = job.get("job_min_salary"), job.get("job_max_salary")
    if not lo and not hi:
        return "Not listed"
    currency = job.get("job_salary_currency") or ""
    period = (job.get("job_salary_period") or "").lower()
    period_txt = {"year": "/yr", "month": "/mo", "hour": "/hr", "week": "/wk"}.get(period, "")

    def fmt(v: Any) -> str:
        try:
            v = float(v)
        except (TypeError, ValueError):
            return str(v)
        return f"{v / 1000:.0f}k" if v >= 10000 else f"{v:,.0f}"

    if lo and hi and lo != hi:
        amount = f"{fmt(lo)}–{fmt(hi)}"
    else:
        amount = fmt(lo or hi)
    return f"{currency} {amount}{period_txt}".strip()


def _format_location(job: dict) -> str:
    if job.get("job_location"):
        loc = str(job["job_location"])
    else:
        parts = [job.get("job_city"), job.get("job_state"), job.get("job_country")]
        loc = ", ".join(p for p in parts if p)
    if job.get("job_is_remote"):
        loc = f"{loc} (Remote)" if loc else "Remote"
    return loc or "Not specified"


def _format_date(job: dict) -> str:
    raw = job.get("job_posted_at_datetime_utc")
    if raw:
        try:
            return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return str(job.get("job_posted_at") or "")


def _highlights_text(job: dict) -> str:
    """Qualifications/Responsibilities bullets, when JSearch extracted them."""
    highlights = job.get("job_highlights") or {}
    out = []
    for key in ("Qualifications", "Responsibilities"):
        items = highlights.get(key) or []
        if items:
            out.append(f"{key}: " + "; ".join(str(i) for i in items[:12]))
    return "\n".join(out)


def normalize_job(job: dict) -> dict:
    """Map a JSearch result to the job dict shape used across Job Suggestions."""
    description = (job.get("job_description") or "").strip()
    apply_options = [
        {"publisher": o.get("publisher", ""), "url": o.get("apply_link", "")}
        for o in (job.get("apply_options") or [])
        if o.get("apply_link")
    ]
    url = job.get("job_apply_link") or (apply_options[0]["url"] if apply_options else "") or "N/A"
    return {
        "job_id": job.get("job_id", ""),
        "title": (job.get("job_title") or "").strip(),
        "company": (job.get("employer_name") or "").strip(),
        "location": _format_location(job),
        "salary": _format_salary(job),
        "snippet": description[:300],
        "description": description,
        "highlights": _highlights_text(job),
        "date_posted": _format_date(job),
        "url": url,
        "apply_options": apply_options,
        "apply_is_direct": bool(job.get("job_apply_is_direct")),
        "employment_type": job.get("job_employment_type") or "",
        "is_remote": bool(job.get("job_is_remote")),
        "employer_logo": job.get("employer_logo") or "",
        "source": job.get("job_publisher") or "JSearch",
        "provider": "jsearch",
    }


async def search_jobs(
    query: str,
    location: str = "",
    country: str = "",
    date_posted: str = "all",
    remote_only: bool = False,
    num_pages: int = 1,
    client: Optional[httpx.AsyncClient] = None,
) -> list[dict]:
    """Search JSearch. Returns normalized jobs; raises JSearchError on any failure."""
    key = os.getenv("JSEARCH_API_KEY", "").strip()
    if not key:
        raise JSearchError("JSEARCH_API_KEY is not set")
    host = os.getenv("JSEARCH_API_HOST", "jsearch.p.rapidapi.com").strip()

    full_query = f"{query} in {location}" if location and not remote_only else query
    date_posted = date_posted if date_posted in DATE_POSTED_VALUES else "all"
    params: dict[str, Any] = {
        "query": full_query,
        "page": 1,
        "num_pages": max(1, min(num_pages, 3)),
        "date_posted": date_posted,
    }
    if country:
        params["country"] = country.lower()
    if remote_only:
        params["work_from_home"] = "true"
        params["remote_jobs_only"] = "true"  # older parameter name, harmless if ignored

    cache_key = tuple(sorted(params.items()))
    now = time.monotonic()
    hit = _cache.get(cache_key)
    if hit and hit[0] > now:
        logger.info(f"JSearch cache hit: {full_query!r}")
        return [dict(j) for j in hit[1]]

    try:
        timeout = float(os.getenv("JSEARCH_TIMEOUT", "20"))
    except ValueError:
        timeout = 20.0
    headers = {"X-RapidAPI-Key": key, "X-RapidAPI-Host": host}
    url = f"https://{host}/search"

    owns_client = client is None
    client = client or httpx.AsyncClient(timeout=timeout)
    try:
        resp = await client.get(url, params=params, headers=headers)
    except httpx.HTTPError as e:
        raise JSearchError(f"request failed: {e}") from e
    finally:
        if owns_client:
            await client.aclose()

    if resp.status_code == 429:
        raise JSearchError("rate limit or monthly quota exceeded (HTTP 429)")
    if resp.status_code in (401, 403):
        raise JSearchError(f"not authorized (HTTP {resp.status_code}); check JSEARCH_API_KEY and subscription")
    if resp.status_code >= 400:
        raise JSearchError(f"HTTP {resp.status_code}: {resp.text[:200]}")

    try:
        payload = resp.json()
    except ValueError as e:
        raise JSearchError("invalid JSON response") from e
    if str(payload.get("status", "OK")).upper() == "ERROR":
        raise JSearchError(f"API error: {str(payload.get('error'))[:200]}")

    jobs = [normalize_job(j) for j in (payload.get("data") or []) if j.get("job_title")]
    logger.info(f"JSearch: {len(jobs)} jobs for {full_query!r} (date_posted={date_posted}, remote={remote_only})")

    ttl = _cache_ttl()
    if ttl:
        if len(_cache) > 500:
            _cache.clear()
        _cache[cache_key] = (now + ttl, jobs)
    return [dict(j) for j in jobs]
