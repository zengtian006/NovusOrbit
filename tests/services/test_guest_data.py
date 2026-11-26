"""Tests for src/services/guest_data.py: guest CVs and chats move to the account on sign-in."""

import json
import os
import time

import pytest

from src.services import guest_data, user_context

GUEST = "guest_abcdefghijklmnop"
USER = "65f0c0ffee0000000000abcd"


@pytest.fixture
def roots(tmp_path, monkeypatch):
    users = tmp_path / "user"
    portfolios = tmp_path / "portfolios"
    for module in (guest_data, user_context):
        monkeypatch.setattr(module, "USER_DATA_ROOT", users)
        monkeypatch.setattr(module, "PORTFOLIOS_ROOT", portfolios)
    return users, portfolios


def _make_guest(users, portfolios):
    kb = portfolios / "users" / GUEST / "my-cv"
    (kb / "raw").mkdir(parents=True)
    (kb / "raw" / "cv.pdf").write_text("cv")
    (portfolios / "users" / GUEST / "kb_config.json").write_text(
        json.dumps({"knowledge_bases": {"my-cv": {"path": "my-cv", "status": "ready"}}})
    )
    chats = users / "accounts" / GUEST
    chats.mkdir(parents=True)
    (chats / "chat_sessions.json").write_text(
        json.dumps({"version": "1.0", "sessions": [{"session_id": "g1", "updated_at": 2}]})
    )


def test_guest_data_moves_into_account(roots):
    users, portfolios = roots
    _make_guest(users, portfolios)
    account_chats = users / "accounts" / USER
    account_chats.mkdir(parents=True)
    (account_chats / "chat_sessions.json").write_text(
        json.dumps({"version": "1.0", "sessions": [{"session_id": "u1", "updated_at": 1}]})
    )

    guest_data.move_guest_data_to_user(GUEST, USER)

    account_portfolios = portfolios / "users" / USER
    assert (account_portfolios / "my-cv" / "raw" / "cv.pdf").exists()
    config = json.loads((account_portfolios / "kb_config.json").read_text())
    assert "my-cv" in config["knowledge_bases"]
    sessions = json.loads((account_chats / "chat_sessions.json").read_text())["sessions"]
    assert [s["session_id"] for s in sessions] == ["g1", "u1"]
    assert not (portfolios / "users" / GUEST).exists()
    assert not (users / "accounts" / GUEST).exists()


def test_existing_portfolio_with_same_name_is_never_overwritten(roots):
    users, portfolios = roots
    _make_guest(users, portfolios)
    mine = portfolios / "users" / USER / "my-cv"
    mine.mkdir(parents=True)
    (mine / "keep.txt").write_text("mine")
    (portfolios / "users" / USER / "kb_config.json").write_text(
        json.dumps({"knowledge_bases": {"my-cv": {"path": "my-cv"}}})
    )

    guest_data.move_guest_data_to_user(GUEST, USER)

    assert (mine / "keep.txt").read_text() == "mine"
    assert not (mine / "raw").exists()


def test_stale_guest_folders_are_removed(roots):
    users, portfolios = roots
    _make_guest(users, portfolios)
    account = users / "accounts" / USER
    account.mkdir(parents=True)
    old = time.time() - 30 * 86400
    for path in [*(users / "accounts").rglob("*"), *(portfolios / "users").rglob("*")]:
        os.utime(path, (old, old))

    removed = guest_data.cleanup_stale_guest_data()

    assert removed == 2
    assert account.exists()  # real accounts are never touched
    assert not (users / "accounts" / GUEST).exists()


def test_recent_guest_folders_are_kept(roots):
    users, portfolios = roots
    _make_guest(users, portfolios)
    assert guest_data.cleanup_stale_guest_data() == 0
