"""
Per-user and site-wide limits on endpoints that cost money (LLM calls,
embeddings, scraping, TTS).

Production runs a single backend process, so the counters live in memory and
reset on restart. Each bucket has a per-user limit over a sliding window;
signed-out visitors are keyed by client IP (they all share the ``anonymous``
user id) and get a lower limit. A site-wide daily cap across all buckets acts as
a spending circuit breaker if traffic spikes (for example after a launch).

Environment:
    RATE_LIMIT_ENABLED=false            turn every limit off (default on)
    RATE_LIMIT_MULTIPLIER=2             scale every per-user limit
    RATE_LIMIT_GLOBAL_DAILY=3000        site-wide cap on limited requests per 24h (0 = off)
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
import math
import os
import threading
import time
from typing import Optional

from fastapi import HTTPException, Request

from src.logging import get_logger
from src.services.user_context import ANONYMOUS_USER_ID, get_current_user_id

logger = get_logger("RateLimit")

HOUR = 3600
DAY = 24 * HOUR


@dataclass(frozen=True)
class Bucket:
    limit: int  # requests per window for a signed-in user
    window: int  # seconds
    anon_limit: int  # requests per window for a signed-out visitor (per IP)
    label: str  # shown to the user


BUCKETS: dict[str, Bucket] = {
    "chat": Bucket(limit=100, window=DAY, anon_limit=20, label="chat messages"),
    "interview": Bucket(limit=60, window=DAY, anon_limit=0, label="interview prep requests"),
    "job_suggest": Bucket(limit=10, window=DAY, anon_limit=0, label="job searches"),
    "job_detail": Bucket(limit=60, window=DAY, anon_limit=0, label="job analyses"),
    "resume": Bucket(limit=100, window=DAY, anon_limit=0, label="resume edits"),
    "tts": Bucket(limit=20, window=DAY, anon_limit=0, label="narrations"),
    "upload": Bucket(limit=30, window=DAY, anon_limit=5, label="document uploads"),
}


def _enabled() -> bool:
    return os.getenv("RATE_LIMIT_ENABLED", "true").strip().lower() not in ("0", "false", "no", "off")


def _multiplier() -> float:
    try:
        return max(0.0, float(os.getenv("RATE_LIMIT_MULTIPLIER", "1")))
    except ValueError:
        return 1.0


def _global_daily() -> int:
    try:
        return max(0, int(os.getenv("RATE_LIMIT_GLOBAL_DAILY", "3000")))
    except ValueError:
        return 3000


class RateLimitExceeded(Exception):
    def __init__(self, message: str, retry_after: int, status_code: int = 429):
        super().__init__(message)
        self.message = message
        self.retry_after = retry_after
        self.status_code = status_code


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, key: str, limit: int, window: int, now: Optional[float] = None) -> Optional[int]:
        """Record a request. Returns None if allowed, else seconds until a slot frees up."""
        now = time.monotonic() if now is None else now
        with self._lock:
            q = self._hits[key]
            while q and q[0] <= now - window:
                q.popleft()
            if len(q) >= limit:
                return max(1, math.ceil(q[0] + window - now))
            q.append(now)
            if len(self._hits) > 50_000:  # drop idle keys so memory stays bounded
                for k in [k for k, v in self._hits.items() if not v]:
                    del self._hits[k]
            return None

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


_limiter = SlidingWindowLimiter()


def _format_wait(seconds: int) -> str:
    if seconds < 90:
        return "a minute"
    if seconds < 90 * 60:
        return f"{round(seconds / 60)} minutes"
    return f"{round(seconds / 3600)} hours"


def check(bucket_name: str, client_ip: Optional[str]) -> None:
    """Count one request against ``bucket_name``. Raises RateLimitExceeded when over a limit."""
    if not _enabled():
        return
    bucket = BUCKETS[bucket_name]
    user_id = get_current_user_id()
    signed_in = user_id != ANONYMOUS_USER_ID

    if signed_in:
        key, limit = f"{bucket_name}:user:{user_id}", bucket.limit
    else:
        key, limit = f"{bucket_name}:ip:{client_ip or 'unknown'}", bucket.anon_limit
    limit = int(limit * _multiplier())

    if limit <= 0:
        raise RateLimitExceeded(
            "Please sign in with Google to use this feature.", retry_after=0, status_code=401
        )

    wait = _limiter.hit(key, limit, bucket.window)
    if wait is not None:
        logger.info(f"Rate limit hit: {key} ({limit}/{bucket.window}s)")
        hint = "" if signed_in else " Sign in with Google for a higher limit."
        raise RateLimitExceeded(
            f"You've reached the limit of {limit} {bucket.label} per day. "
            f"Please try again in {_format_wait(wait)}.{hint}",
            retry_after=wait,
        )

    global_cap = _global_daily()
    if global_cap:
        wait = _limiter.hit("__global__", global_cap, DAY)
        if wait is not None:
            logger.warning(f"Site-wide daily cap of {global_cap} requests reached")
            raise RateLimitExceeded(
                "NovusOrbit is very busy right now and has paused new AI requests. "
                "Please try again later.",
                retry_after=wait,
            )


def client_ip_from_headers(headers, fallback: Optional[str]) -> Optional[str]:
    """Client IP behind Caddy.

    Caddy replaces any incoming X-Forwarded-For with the real client address
    (it trusts no upstream proxies by default), so the last entry is reliable.
    """
    xff = headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[-1].strip() or fallback
    return fallback


def rate_limit(bucket_name: str):
    """FastAPI dependency: ``dependencies=[Depends(rate_limit("interview"))]``."""
    if bucket_name not in BUCKETS:
        raise ValueError(f"Unknown rate limit bucket: {bucket_name}")

    async def dependency(request: Request) -> None:
        ip = client_ip_from_headers(request.headers, request.client.host if request.client else None)
        try:
            check(bucket_name, ip)
        except RateLimitExceeded as e:
            headers = {"Retry-After": str(e.retry_after)} if e.retry_after else None
            raise HTTPException(status_code=e.status_code, detail=e.message, headers=headers)

    return dependency
