"""
Identify the signed-in user for every backend request.

The Next.js frontend signs users in with NextAuth (database sessions stored in
MongoDB by Prisma). The browser sends the NextAuth session cookie to this
backend too (same host), so we look the token up in the ``Session`` collection
and expose the user id through ``src.services.user_context``.

Signed-out visitors who use a guest tool (portfolio, chat) get a private
guest id kept in the ``novusorbit_guest`` cookie, so guests never share data.
When a guest signs in, their guest data moves into the account and the cookie
is cleared (see ``src/services/guest_data.py``).

This middleware never rejects a request; access rules live in
``src/api/auth_deps.py``. It only decides whose data a request reads and writes.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from http.cookies import CookieError, SimpleCookie
import os
import re
import secrets
import time
from typing import Any, Optional

from src.logging import get_logger
from src.services.user_context import GUEST_PREFIX, reset_current_user_id, set_current_user_id

logger = get_logger("UserContext")

# NextAuth v5 (authjs) and v4 cookie names; "__Secure-" prefix is used on HTTPS.
SESSION_COOKIE_NAMES = (
    "__Secure-authjs.session-token",
    "authjs.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.session-token",
)

GUEST_COOKIE = "novusorbit_guest"
GUEST_COOKIE_MAX_AGE = 30 * 24 * 3600
_GUEST_VALUE_RE = re.compile(r"^[A-Za-z0-9_-]{16,40}$")
# Only these tools are open to guests, so only they hand out a guest id.
GUEST_PATH_PREFIXES = ("/api/v1/portfolio", "/api/v1/chat")

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


def _cookies_from_scope(scope) -> dict[str, str]:
    cookies: dict[str, str] = {}
    for name, value in scope.get("headers") or []:
        if name != b"cookie":
            continue
        try:
            jar = SimpleCookie()
            jar.load(value.decode("latin-1"))
        except CookieError:
            continue
        cookies.update({k: m.value for k, m in jar.items()})
    return cookies


def _session_token_from_scope(scope) -> Optional[str]:
    cookies = _cookies_from_scope(scope)
    for cookie_name in SESSION_COOKIE_NAMES:
        if cookies.get(cookie_name):
            return cookies[cookie_name]
    return None


def _is_https(scope) -> bool:
    if scope.get("scheme") in ("https", "wss"):
        return True
    for name, value in scope.get("headers") or []:
        if name == b"x-forwarded-proto":
            return value.decode("latin-1").split(",")[0].strip() == "https"
    return False


def _guest_cookie_header(scope, value: str, max_age: int) -> tuple[bytes, bytes]:
    parts = [f"{GUEST_COOKIE}={value}", "Path=/", f"Max-Age={max_age}", "HttpOnly", "SameSite=Lax"]
    if _is_https(scope):
        parts.append("Secure")
    return (b"set-cookie", "; ".join(parts).encode("latin-1"))


class UserContextMiddleware:
    """Pure ASGI middleware (works for HTTP and WebSocket routes)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return
        cookies = _cookies_from_scope(scope)
        token = next((cookies[n] for n in SESSION_COOKIE_NAMES if cookies.get(n)), None)
        user_id = await resolve_user_id(token) if token else None

        guest_value = cookies.get(GUEST_COOKIE, "")
        if not _GUEST_VALUE_RE.match(guest_value):
            guest_value = ""
        set_cookie: Optional[tuple[bytes, bytes]] = None

        if user_id:
            if guest_value and scope["type"] == "http":
                # Just signed in after trying the app as a guest: keep their CV and chats.
                from src.services.guest_data import move_guest_data_to_user

                await asyncio.to_thread(move_guest_data_to_user, GUEST_PREFIX + guest_value, user_id)
                set_cookie = _guest_cookie_header(scope, "", 0)
        elif auth_available():
            if guest_value:
                user_id = GUEST_PREFIX + guest_value
            elif scope["type"] == "http" and scope.get("path", "").startswith(GUEST_PATH_PREFIXES):
                guest_value = secrets.token_urlsafe(16)
                user_id = GUEST_PREFIX + guest_value
                set_cookie = _guest_cookie_header(scope, guest_value, GUEST_COOKIE_MAX_AGE)

        ctx = set_current_user_id(user_id)

        async def send_with_cookie(message):
            if set_cookie and message["type"] == "http.response.start":
                message = {**message, "headers": [*message.get("headers", []), set_cookie]}
            await send(message)

        try:
            await self.app(scope, receive, send_with_cookie if set_cookie else send)
        finally:
            reset_current_user_id(ctx)


def auth_available() -> bool:
    """True when sign-in works (NextAuth MongoDB reachable). Local installs without it run open."""
    return _get_db() is not None


_admin_cache: dict[str, tuple[bool, float]] = {}


def _lookup_is_admin(user_id: str) -> bool:
    db = _get_db()
    if db is None:
        return False
    from bson import ObjectId
    from bson.errors import InvalidId

    try:
        oid = ObjectId(user_id)
    except (InvalidId, TypeError):
        return False
    doc = db["User"].find_one({"_id": oid}, {"role": 1})
    return bool(doc and doc.get("role") == "ADMIN")


async def is_admin_user(user_id: str) -> bool:
    """Whether a user has the ADMIN role, with a short in-memory cache."""
    now = time.monotonic()
    cached = _admin_cache.get(user_id)
    if cached and cached[1] > now:
        return cached[0]
    try:
        result = await asyncio.wait_for(asyncio.to_thread(_lookup_is_admin, user_id), timeout=5)
    except Exception as e:
        logger.warning(f"Admin lookup failed, treating user as non-admin: {e}")
        return False
    if len(_admin_cache) > 10_000:
        _admin_cache.clear()
    _admin_cache[user_id] = (result, now + CACHE_TTL_SECONDS)
    return result


def find_first_admin_id() -> Optional[str]:
    """Id of the earliest-created ADMIN user, or None if unavailable."""
    db = _get_db()
    if db is None:
        return None
    doc = db["User"].find_one({"role": "ADMIN"}, {"_id": 1}, sort=[("createdAt", 1)])
    return str(doc["_id"]) if doc else None
