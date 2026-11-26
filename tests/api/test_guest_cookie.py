"""Tests for the guest cookie in src/api/user_middleware.py."""

import asyncio

import pytest

from src.api import user_middleware
from src.services.user_context import get_current_user_id


def _call(path: str, cookie: str | None = None, scheme: str = "https"):
    seen = {}

    async def app(scope, receive, send):
        seen["user"] = get_current_user_id()
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b""})

    sent = []

    async def send(message):
        sent.append(message)

    async def receive():
        return {"type": "http.request"}

    headers = [(b"cookie", cookie.encode())] if cookie else []
    scope = {"type": "http", "path": path, "method": "GET", "headers": headers, "scheme": scheme}
    asyncio.run(user_middleware.UserContextMiddleware(app)(scope, receive, send))
    cookies = [v.decode() for k, v in sent[0]["headers"] if k == b"set-cookie"]
    return seen["user"], cookies


@pytest.fixture(autouse=True)
def auth_on(monkeypatch):
    monkeypatch.setattr(user_middleware, "auth_available", lambda: True)

    async def resolve(token):
        return "user1" if token == "valid" else None

    monkeypatch.setattr(user_middleware, "resolve_user_id", resolve)


def test_new_visitor_on_a_guest_tool_gets_a_private_guest_id():
    user, cookies = _call("/api/v1/portfolio/list")
    assert user.startswith("guest_")
    assert len(cookies) == 1
    assert cookies[0].startswith("novusorbit_guest=")
    assert "HttpOnly" in cookies[0] and "Secure" in cookies[0]
    other, _ = _call("/api/v1/portfolio/list")
    assert other != user  # never shared between visitors


def test_returning_guest_keeps_their_id():
    user, cookies = _call("/api/v1/chat/sessions", "novusorbit_guest=abcdefghijklmnop")
    assert user == "guest_abcdefghijklmnop"
    assert cookies == []


def test_other_tools_do_not_create_guests():
    user, cookies = _call("/api/v1/jobs/list")
    assert user == "anonymous"
    assert cookies == []


def test_sign_in_moves_guest_data_and_clears_cookie(monkeypatch):
    moved = []
    from src.services import guest_data

    monkeypatch.setattr(guest_data, "move_guest_data_to_user", lambda g, u: moved.append((g, u)))
    user, cookies = _call("/api/v1/jobs/list", "authjs.session-token=valid; novusorbit_guest=abcdefghijklmnop")
    assert user == "user1"
    assert moved == [("guest_abcdefghijklmnop", "user1")]
    assert cookies and "Max-Age=0" in cookies[0]


def test_malformed_guest_cookie_is_ignored():
    user, _ = _call("/api/v1/jobs/list", "novusorbit_guest=../../etc")
    assert user == "anonymous"
