"""
Per-request user context and per-user data directories.

The backend identifies the signed-in user from the NextAuth session cookie
(see ``src/api/user_middleware.py``) and stores the user id in a context
variable for the duration of the request. Data that belongs to a user is
stored under per-user roots inside the mounted data volumes:

    data/user/accounts/<user_id>/        sessions, job boards, resume writer
    data/portfolios/users/<user_id>/     portfolios (raw files + indexes)

Signed-out visitors who try the app get a private guest id
(``guest_<random>``, from a cookie; see ``src/api/user_middleware.py``).
Requests with neither are ``anonymous``. Requests are never rejected here;
this module only decides *where* data lives.

Context variables propagate into ``asyncio.create_task`` and
``asyncio.to_thread`` automatically. Code that uses
``loop.run_in_executor`` must resolve paths before entering the executor.
"""

from __future__ import annotations

from contextvars import ContextVar
from pathlib import Path
import re

from src.config.constants import PROJECT_ROOT

ANONYMOUS_USER_ID = "anonymous"
GUEST_PREFIX = "guest_"

_current_user_id: ContextVar[str] = ContextVar("current_user_id", default=ANONYMOUS_USER_ID)

# User ids come from MongoDB ObjectIds; restrict to a safe charset so an id can
# never escape its directory.
_SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

USER_DATA_ROOT = PROJECT_ROOT / "data" / "user"
PORTFOLIOS_ROOT = PROJECT_ROOT / "data" / "portfolios"


def _safe_id(user_id: str | None) -> str:
    if user_id and _SAFE_ID_RE.match(user_id):
        return user_id
    return ANONYMOUS_USER_ID


def is_guest(user_id: str | None) -> bool:
    """A signed-out visitor with their own guest space."""
    return bool(user_id) and user_id.startswith(GUEST_PREFIX)


def is_signed_in(user_id: str | None = None) -> bool:
    """A real account (not anonymous, not a guest)."""
    uid = get_current_user_id() if user_id is None else user_id
    return uid != ANONYMOUS_USER_ID and not is_guest(uid)


def get_current_user_id() -> str:
    """Id of the user for the current request (``anonymous`` if signed out)."""
    return _current_user_id.get()


def set_current_user_id(user_id: str | None):
    """Set the current user id; returns a token for ``reset_current_user_id``."""
    return _current_user_id.set(_safe_id(user_id))


def reset_current_user_id(token) -> None:
    _current_user_id.reset(token)


def user_data_dir(user_id: str | None = None) -> Path:
    """Per-user root for sessions, job boards and resume writer data."""
    uid = _safe_id(user_id) if user_id is not None else get_current_user_id()
    path = USER_DATA_ROOT / "accounts" / uid
    path.mkdir(parents=True, exist_ok=True)
    return path


def portfolios_dir(user_id: str | None = None) -> Path:
    """Per-user root for portfolios (knowledge bases)."""
    uid = _safe_id(user_id) if user_id is not None else get_current_user_id()
    path = PORTFOLIOS_ROOT / "users" / uid
    path.mkdir(parents=True, exist_ok=True)
    return path


__all__ = [
    "ANONYMOUS_USER_ID",
    "GUEST_PREFIX",
    "is_guest",
    "is_signed_in",
    "PORTFOLIOS_ROOT",
    "USER_DATA_ROOT",
    "get_current_user_id",
    "portfolios_dir",
    "reset_current_user_id",
    "set_current_user_id",
    "user_data_dir",
]
