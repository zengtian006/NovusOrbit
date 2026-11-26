"""Tests for src/api/auth_deps.py: tools need sign-in, settings changes need an admin."""

import asyncio

from fastapi import HTTPException, WebSocketException
import pytest
from starlette.requests import HTTPConnection

from src.api import auth_deps
from src.services.user_context import reset_current_user_id, set_current_user_id


def _conn(kind: str = "http", method: str = "GET") -> HTTPConnection:
    scope = {"type": kind, "headers": [], "path": "/x"}
    if kind == "http":
        scope["method"] = method
    return HTTPConnection(scope)


def _run(dep, conn, user: str | None):
    token = set_current_user_id(user)
    try:
        return asyncio.run(dep(conn))
    finally:
        reset_current_user_id(token)


@pytest.fixture
def auth_on(monkeypatch):
    monkeypatch.setattr(auth_deps, "auth_available", lambda: True)

    async def is_admin(user_id):
        return user_id == "admin1"

    monkeypatch.setattr(auth_deps, "is_admin_user", is_admin)


def test_signed_out_cannot_use_tools(auth_on):
    with pytest.raises(HTTPException) as e:
        _run(auth_deps.require_user, _conn(), None)
    assert e.value.status_code == 401
    assert "sign in" in e.value.detail.lower()


def test_signed_in_can_use_tools(auth_on):
    _run(auth_deps.require_user, _conn(), "user1")


def test_signed_out_websocket_is_rejected(auth_on):
    with pytest.raises(WebSocketException) as e:
        _run(auth_deps.require_user, _conn("websocket"), None)
    assert e.value.code == 1008


def test_anyone_can_read_settings_only_admin_can_change(auth_on):
    dep = auth_deps.require_admin_for_writes
    _run(dep, _conn(method="GET"), None)
    with pytest.raises(HTTPException) as e:
        _run(dep, _conn(method="PUT"), None)
    assert e.value.status_code == 401
    with pytest.raises(HTTPException) as e:
        _run(dep, _conn(method="PUT"), "user1")
    assert e.value.status_code == 403
    _run(dep, _conn(method="PUT"), "admin1")


def test_config_is_admin_only(auth_on):
    with pytest.raises(HTTPException) as e:
        _run(auth_deps.require_admin, _conn(method="GET"), "user1")
    assert e.value.status_code == 403
    _run(auth_deps.require_admin, _conn(method="GET"), "admin1")


GUEST = "guest_abcdefghijklmnop"


def test_guest_can_try_chat_and_portfolio_but_not_other_tools(auth_on):
    _run(auth_deps.require_visitor, _conn(), GUEST)
    with pytest.raises(HTTPException) as e:
        _run(auth_deps.require_visitor, _conn(), None)
    assert e.value.status_code == 401
    with pytest.raises(HTTPException) as e:
        _run(auth_deps.require_user, _conn(), GUEST)
    assert e.value.status_code == 401


def test_guest_gets_exactly_one_cv(auth_on, monkeypatch, tmp_path):
    monkeypatch.setattr(auth_deps, "portfolios_dir", lambda: tmp_path)
    _run(auth_deps.guest_single_cv, _conn(method="POST"), GUEST)  # first CV: allowed
    (tmp_path / "kb_config.json").write_text('{"knowledge_bases": {"cv": {"path": "cv"}}}')
    with pytest.raises(HTTPException) as e:
        _run(auth_deps.guest_single_cv, _conn(method="POST"), GUEST)
    assert e.value.status_code == 403
    assert "one CV" in e.value.detail
    _run(auth_deps.guest_single_cv, _conn(method="POST"), "user1")  # accounts: no such limit
    with pytest.raises(HTTPException):
        _run(auth_deps.deny_guest, _conn(method="DELETE"), GUEST)
    _run(auth_deps.deny_guest, _conn(method="DELETE"), "user1")


def test_open_when_sign_in_is_not_configured(monkeypatch):
    monkeypatch.setattr(auth_deps, "auth_available", lambda: False)
    _run(auth_deps.require_user, _conn(), None)
    _run(auth_deps.require_admin_for_writes, _conn(method="PUT"), None)
