"""Tests for src/services/rate_limit.py."""

import asyncio

from fastapi import HTTPException, Request
import pytest

from src.services import rate_limit as rl
from src.services.rate_limit import (
    DAY,
    Bucket,
    RateLimitExceeded,
    SlidingWindowLimiter,
    check,
    client_ip_from_headers,
    rate_limit,
)
from src.services.user_context import reset_current_user_id, set_current_user_id


@pytest.fixture(autouse=True)
def _fresh(monkeypatch):
    rl._limiter.reset()
    monkeypatch.delenv("RATE_LIMIT_ENABLED", raising=False)
    monkeypatch.delenv("RATE_LIMIT_MULTIPLIER", raising=False)
    monkeypatch.delenv("RATE_LIMIT_GLOBAL_DAILY", raising=False)
    yield
    rl._limiter.reset()


@pytest.fixture
def anon_trial_bucket(monkeypatch):
    """Production gives signed-out visitors no AI use; test the per-IP mechanism on a stand-in bucket."""
    monkeypatch.setitem(rl.BUCKETS, "chat", Bucket(limit=100, window=DAY, anon_limit=20, label="chat messages"))


@pytest.fixture
def signed_in():
    token = set_current_user_id("user123")
    yield
    reset_current_user_id(token)


def test_sliding_window_allows_then_blocks_then_frees():
    lim = SlidingWindowLimiter()
    assert lim.hit("k", 2, 60, now=0) is None
    assert lim.hit("k", 2, 60, now=10) is None
    assert lim.hit("k", 2, 60, now=20) == 40  # oldest hit (t=0) expires at t=60
    assert lim.hit("k", 2, 60, now=60) is None


def test_signed_in_user_limit(signed_in):
    for _ in range(rl.BUCKETS["job_suggest"].limit):
        check("job_suggest", "1.2.3.4")
    with pytest.raises(RateLimitExceeded) as e:
        check("job_suggest", "1.2.3.4")
    assert e.value.status_code == 429
    assert "10 job searches per day" in e.value.message


def test_signed_in_users_are_counted_separately():
    for user in ("a", "b"):
        token = set_current_user_id(user)
        try:
            for _ in range(rl.BUCKETS["job_suggest"].limit):
                check("job_suggest", "1.2.3.4")
        finally:
            reset_current_user_id(token)


def test_signed_out_visitors_can_only_chat_and_upload():
    tryable = {name for name, b in rl.BUCKETS.items() if b.anon_limit > 0}
    assert tryable == {"chat", "upload"}
    for name in rl.BUCKETS.keys() - tryable:
        with pytest.raises(RateLimitExceeded) as e:
            check(name, "1.1.1.1")
        assert e.value.status_code == 401


def test_guests_use_the_signed_out_per_ip_limit():
    token = set_current_user_id("guest_abcdefghijklmnop")
    try:
        for _ in range(rl.BUCKETS["chat"].anon_limit):
            check("chat", "3.3.3.3")
        with pytest.raises(RateLimitExceeded) as e:
            check("chat", "3.3.3.3")
        assert "Sign in" in e.value.message
    finally:
        reset_current_user_id(token)


def test_anonymous_keyed_by_ip_and_told_to_sign_in(anon_trial_bucket):
    limit = rl.BUCKETS["chat"].anon_limit
    for _ in range(limit):
        check("chat", "1.1.1.1")
    with pytest.raises(RateLimitExceeded) as e:
        check("chat", "1.1.1.1")
    assert "Sign in" in e.value.message
    check("chat", "2.2.2.2")  # another visitor is unaffected


def test_anonymous_blocked_on_sign_in_only_bucket():
    with pytest.raises(RateLimitExceeded) as e:
        check("interview", "1.1.1.1")
    assert e.value.status_code == 401


def test_disabled_and_multiplier(monkeypatch, signed_in):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    for _ in range(100):
        check("job_suggest", None)
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_MULTIPLIER", "0.2")  # 10 * 0.2 = 2
    rl._limiter.reset()
    check("job_suggest", None)
    check("job_suggest", None)
    with pytest.raises(RateLimitExceeded):
        check("job_suggest", None)


def test_global_daily_cap(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_GLOBAL_DAILY", "3")
    for user in ("a", "b", "c"):
        token = set_current_user_id(user)
        try:
            check("chat", None)
        finally:
            reset_current_user_id(token)
    token = set_current_user_id("d")
    try:
        with pytest.raises(RateLimitExceeded) as e:
            check("chat", None)
        assert "busy" in e.value.message
        assert 0 < e.value.retry_after <= DAY
    finally:
        reset_current_user_id(token)


def test_client_ip_uses_last_forwarded_entry():
    assert client_ip_from_headers({"x-forwarded-for": "6.6.6.6, 9.9.9.9"}, "127.0.0.1") == "9.9.9.9"
    assert client_ip_from_headers({}, "127.0.0.1") == "127.0.0.1"


def test_dependency_raises_429_with_retry_after(monkeypatch, anon_trial_bucket):
    monkeypatch.setenv("RATE_LIMIT_MULTIPLIER", "0.1")  # chat anon 20 -> 2
    dep = rate_limit("chat")
    request = Request({"type": "http", "headers": [], "client": ("5.5.5.5", 1234)})
    asyncio.run(dep(request))
    asyncio.run(dep(request))
    with pytest.raises(HTTPException) as e:
        asyncio.run(dep(request))
    assert e.value.status_code == 429
    assert int(e.value.headers["Retry-After"]) > 0
    assert "limit" in e.value.detail
