"""
Access rules for the API, as FastAPI dependencies.

- ``require_visitor``: the tools a signed-out visitor may try (portfolio, chat).
  They get a private guest space (cookie), never a shared one.
- ``guest_single_cv`` / ``deny_guest``: a guest can upload exactly one CV; adding
  documents, deleting (to upload again) needs an account.
- ``require_user``: everything else (jobs, job search, resume writer,
  interview prep, generated files) needs a signed-in account.
- ``require_admin`` / ``require_admin_for_writes``: site-wide settings and
  model/provider configuration can only be changed by an ADMIN.

When sign-in isn't available (no NextAuth MongoDB, e.g. a local single-user
install), these checks are skipped so self-hosting keeps working.
"""

from __future__ import annotations

from fastapi import HTTPException, WebSocketException, status
from starlette.requests import HTTPConnection

from src.api.user_middleware import auth_available, is_admin_user
from src.services.user_context import ANONYMOUS_USER_ID, get_current_user_id, is_guest, portfolios_dir

SIGN_IN_MESSAGE = "Please sign in with Google to use this. It's free."
GUEST_CV_MESSAGE = "As a guest you can upload one CV. Sign in with Google to upload more or replace it. It's free."
ADMIN_MESSAGE = "Only an admin can change this setting."
SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def _deny(conn: HTTPConnection, code: int, message: str):
    if conn.scope["type"] == "websocket":
        return WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=message)
    return HTTPException(status_code=code, detail=message)


async def require_visitor(conn: HTTPConnection) -> None:
    """Signed in, or a guest with their own space."""
    if not auth_available():
        return
    if get_current_user_id() == ANONYMOUS_USER_ID:
        raise _deny(conn, status.HTTP_401_UNAUTHORIZED, SIGN_IN_MESSAGE)


async def require_user(conn: HTTPConnection) -> None:
    """A signed-in account (guests are asked to sign in)."""
    if not auth_available():
        return
    user_id = get_current_user_id()
    if user_id == ANONYMOUS_USER_ID or is_guest(user_id):
        raise _deny(conn, status.HTTP_401_UNAUTHORIZED, SIGN_IN_MESSAGE)


def _guest_has_portfolio() -> bool:
    config = portfolios_dir() / "kb_config.json"
    if not config.exists():
        return False
    try:
        import json

        with open(config, encoding="utf-8") as f:
            return bool((json.load(f) or {}).get("knowledge_bases"))
    except (OSError, ValueError):
        return True  # unreadable: don't let a guest create more


async def guest_single_cv(conn: HTTPConnection) -> None:
    """A guest may create one portfolio (their CV); a second needs an account."""
    if is_guest(get_current_user_id()) and _guest_has_portfolio():
        raise _deny(conn, status.HTTP_403_FORBIDDEN, GUEST_CV_MESSAGE)


async def deny_guest(conn: HTTPConnection) -> None:
    """Actions that would let a guest go past one CV (add documents, delete and re-upload)."""
    if is_guest(get_current_user_id()):
        raise _deny(conn, status.HTTP_403_FORBIDDEN, GUEST_CV_MESSAGE)


async def require_admin(conn: HTTPConnection) -> None:
    if not auth_available():
        return
    user_id = get_current_user_id()
    if user_id == ANONYMOUS_USER_ID:
        raise _deny(conn, status.HTTP_401_UNAUTHORIZED, SIGN_IN_MESSAGE)
    if not await is_admin_user(user_id):
        raise _deny(conn, status.HTTP_403_FORBIDDEN, ADMIN_MESSAGE)


async def require_admin_for_writes(conn: HTTPConnection) -> None:
    """Anyone may read; only an admin may change (non-GET requests)."""
    if conn.scope["type"] == "http" and conn.scope.get("method", "GET") in SAFE_METHODS:
        return
    await require_admin(conn)


__all__ = [
    "GUEST_CV_MESSAGE",
    "SIGN_IN_MESSAGE",
    "deny_guest",
    "guest_single_cv",
    "require_admin",
    "require_admin_for_writes",
    "require_user",
    "require_visitor",
]
