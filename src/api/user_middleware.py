"""
Identify the signed-in user for every backend request.

The Next.js frontend signs users in with NextAuth (database sessions stored in
MongoDB by Prisma). The browser sends the NextAuth session cookie to this
backend too (same host), so we look the token up in the ``Session`` collection
and expose the user id through ``src.services.user_context``.

This middleware never rejects a request: signed-out or unknown sessions are
treated as the shared ``anonymous`` user. It only decides whose data a request
reads and writes.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from http.cookies import CookieError, SimpleCookie
import os
import time
from typing import Any, Optional

from src.logging import get_logger
from src.services.user_context import reset_current_user_id, set_current_user_id

logger = get_logger("UserContext")

# NextAuth v5 (authjs) and v4 cookie names; "__Secure-" prefix is used on HTTPS.
SESSION_COOKIE_NAMES = (
    "__Secure-authjs.session-token",
    "authjs.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.session-token",
)

CACHE_TTL_SECONDS = 60
_cache: dict[str, tuple[Optional[str], float]] = {}  # token -> (user_id | None, expires_at)
_db: Any = None
_db_unavailable_logged = False


def _get_db():
    """Lazily connect to the NextAuth MongoDB (DATABASE_URL). Returns None if unavailable."""
    global _db, _db_unavailable_logged
    if _db is not None:
        return _db
    url = os.getenv("DATABASE_URL", "")
    if not url.startswith(("mongodb://", "mongodb+srv://")):
        if not _db_unavailable_logged:
            logger.warning("DATABASE_URL is not a MongoDB URL; all requests use the anonymous user")
            _db_unavailable_logged = True
        return None
    try:
        from pymongo import MongoClient

        client = MongoClient(url, serverSelectionTimeoutMS=3000, connectTimeoutMS=3000)
        _db = client.get_default_database()
        return _db
    except Exception as e:  # pragma: no cover - depends on environment
        if not _db_unavailable_logged:
            logger.warning(f"Could not connect to MongoDB for session lookup: {e}")
            _db_unavailable_logged = True
        return None


def _lookup_user_id(token: str) -> Optional[str]:
    """Blocking MongoDB lookup of a NextAuth session token."""
    db = _get_db()
    if db is None:
        return None
    doc = db["Session"].find_one({"sessionToken": token}, {"userId": 1, "expires": 1})
    if not doc:
        return None
    expires = doc.get("expires")
    if isinstance(expires, datetime):
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires <= datetime.now(timezone.utc):
            return None
    user_id = doc.get("userId")
    return str(user_id) if user_id else None


async def resolve_user_id(token: str) -> Optional[str]:
    """Resolve a session token to a user id, with a short in-memory cache."""
    now = time.monotonic()
    cached = _cache.get(token)
    if cached and cached[1] > now:
        return cached[0]
    try:
        user_id = await asyncio.wait_for(asyncio.to_thread(_lookup_user_id, token), timeout=5)
    except Exception as e:
        logger.warning(f"Session lookup failed, treating request as anonymous: {e}")
        return None
    if len(_cache) > 10_000:
        _cache.clear()
    _cache[token] = (user_id, now + CACHE_TTL_SECONDS)
    return user_id


def _session_token_from_scope(scope) -> Optional[str]:
    for name, value in scope.get("headers") or []:
        if name != b"cookie":
            continue
        try:
            cookie = SimpleCookie()
            cookie.load(value.decode("latin-1"))
        except CookieError:
            continue
        for cookie_name in SESSION_COOKIE_NAMES:
            if cookie_name in cookie and cookie[cookie_name].value:
                return cookie[cookie_name].value
    return None


class UserContextMiddleware:
    """Pure ASGI middleware (works for HTTP and WebSocket routes)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return
        token = _session_token_from_scope(scope)
        user_id = await resolve_user_id(token) if token else None
        ctx = set_current_user_id(user_id)
        try:
            await self.app(scope, receive, send)
        finally:
            reset_current_user_id(ctx)


def find_first_admin_id() -> Optional[str]:
    """Id of the earliest-created ADMIN user, or None if unavailable."""
    db = _get_db()
    if db is None:
        return None
    doc = db["User"].find_one({"role": "ADMIN"}, {"_id": 1}, sort=[("createdAt", 1)])
    return str(doc["_id"]) if doc else None
