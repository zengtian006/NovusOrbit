"""
Guest data: what a signed-out visitor creates while trying the app.

A guest (``guest_<random>``) can upload one CV and ask a few questions. Their
data lives in its own folders, like an account's:

    data/user/accounts/guest_<id>/        chat_sessions.json
    data/portfolios/users/guest_<id>/     kb_config.json + one folder per portfolio

When the guest signs in, ``move_guest_data_to_user`` moves it into their
account so nothing is lost. Guest folders nobody has touched for
``GUEST_TTL_DAYS`` are deleted by ``cleanup_stale_guest_data``.
"""

from __future__ import annotations

import json
from pathlib import Path
import shutil
import threading
import time

from src.logging import get_logger
from src.services.user_context import (
    PORTFOLIOS_ROOT,
    USER_DATA_ROOT,
    is_guest,
    portfolios_dir,
    user_data_dir,
)

logger = get_logger("GuestData")

GUEST_TTL_DAYS = 7
_lock = threading.Lock()


def _guest_roots(guest_id: str) -> tuple[Path, Path]:
    return USER_DATA_ROOT / "accounts" / guest_id, PORTFOLIOS_ROOT / "users" / guest_id


def _read_json(path: Path, default: dict) -> dict:
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else default
    except (OSError, ValueError):
        return default


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    tmp.replace(path)


def _move_portfolios(guest_dir: Path, user_dir: Path) -> int:
    guest_config = _read_json(guest_dir / "kb_config.json", {"knowledge_bases": {}})
    user_config_path = user_dir / "kb_config.json"
    user_config = _read_json(user_config_path, {"knowledge_bases": {}})
    user_kbs = user_config.setdefault("knowledge_bases", {})
    moved = 0
    for name, entry in (guest_config.get("knowledge_bases") or {}).items():
        source = guest_dir / name
        target = user_dir / name
        if name in user_kbs or target.exists() or not source.is_dir():
            continue  # never overwrite the account's own portfolio
        shutil.move(str(source), str(target))
        user_kbs[name] = entry
        moved += 1
    if moved:
        _write_json(user_config_path, user_config)
    return moved


def _move_chat_sessions(guest_dir: Path, user_dir: Path) -> int:
    guest_file = guest_dir / "chat_sessions.json"
    if not guest_file.exists():
        return 0
    guest_sessions = _read_json(guest_file, {}).get("sessions") or []
    user_file = user_dir / "chat_sessions.json"
    user_data = _read_json(user_file, {"version": "1.0", "sessions": []})
    sessions = user_data.setdefault("sessions", [])
    known = {s.get("session_id") for s in sessions if isinstance(s, dict)}
    new = [s for s in guest_sessions if isinstance(s, dict) and s.get("session_id") not in known]
    if new:
        sessions.extend(new)
        sessions.sort(key=lambda s: s.get("updated_at") or 0, reverse=True)
        _write_json(user_file, user_data)
    return len(new)


def move_guest_data_to_user(guest_id: str, user_id: str) -> None:
    """Move a guest's CV and chats into the account they just signed in to."""
    if not is_guest(guest_id) or is_guest(user_id):
        return
    accounts_dir, guest_portfolios = _guest_roots(guest_id)
    if not accounts_dir.exists() and not guest_portfolios.exists():
        return
    with _lock:
        try:
            portfolios = _move_portfolios(guest_portfolios, portfolios_dir(user_id)) if guest_portfolios.exists() else 0
            chats = _move_chat_sessions(accounts_dir, user_data_dir(user_id)) if accounts_dir.exists() else 0
            logger.info(f"Moved guest data into account: {portfolios} portfolio(s), {chats} chat(s)")
        except Exception:
            logger.exception("Moving guest data into account failed; guest data kept")
            return
        shutil.rmtree(accounts_dir, ignore_errors=True)
        shutil.rmtree(guest_portfolios, ignore_errors=True)


def _last_modified(path: Path) -> float:
    latest = path.stat().st_mtime
    for child in path.rglob("*"):
        try:
            latest = max(latest, child.stat().st_mtime)
        except OSError:
            continue
    return latest


def cleanup_stale_guest_data(max_age_days: float = GUEST_TTL_DAYS) -> int:
    """Delete guest folders untouched for ``max_age_days``. Returns how many were removed."""
    cutoff = time.time() - max_age_days * 86400
    removed = 0
    for root in (USER_DATA_ROOT / "accounts", PORTFOLIOS_ROOT / "users"):
        if not root.is_dir():
            continue
        for folder in root.iterdir():
            if not (folder.is_dir() and is_guest(folder.name)):
                continue
            try:
                if _last_modified(folder) < cutoff:
                    shutil.rmtree(folder, ignore_errors=True)
                    removed += 1
            except OSError:
                continue
    if removed:
        logger.info(f"Removed {removed} stale guest folder(s)")
    return removed


__all__ = ["GUEST_TTL_DAYS", "cleanup_stale_guest_data", "move_guest_data_to_user"]
