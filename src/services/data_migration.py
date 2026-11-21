"""
One-time migration of pre-per-user (shared) data into the first admin's account.

Before per-user data, everything lived directly under:
    data/portfolios/<kb_name>/, data/portfolios/kb_config.json
    data/user/{chat,interview,job_suggest}_sessions.json, data/user/jobs/,
    data/user/resume-writer/

This moves those items into the earliest ADMIN user's namespace
(see src/services/user_context.py). It runs at backend startup only when
MIGRATE_LEGACY_DATA=1 (set in the Docker image), is idempotent (a marker
file records completion), never overwrites existing destination data, and
retries on the next start if no admin user can be found yet.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil

from src.logging import get_logger
from src.services.user_context import (
    PORTFOLIOS_ROOT,
    USER_DATA_ROOT,
    portfolios_dir,
    user_data_dir,
)

logger = get_logger("DataMigration")

MARKER_FILE = USER_DATA_ROOT / ".legacy_data_migrated.json"
LEGACY_USER_ITEMS = (
    "chat_sessions.json",
    "interview_sessions.json",
    "job_suggest_sessions.json",
    "jobs",
    "resume-writer",
)


def _enabled() -> bool:
    return os.getenv("MIGRATE_LEGACY_DATA", "").strip().lower() in ("1", "true", "yes")


def _move(src: Path, dest: Path, moved: list[str], skipped: list[str]) -> None:
    if dest.exists():
        skipped.append(f"{src} (destination exists)")
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dest))
    moved.append(f"{src} -> {dest}")


def migrate_legacy_data(admin_id: str | None = None) -> dict | None:
    """
    Move legacy shared data to the first admin. Returns a summary, or None if
    skipped (disabled, already done, or no admin available).
    """
    if not _enabled() or MARKER_FILE.exists():
        return None

    legacy_portfolios = []
    if PORTFOLIOS_ROOT.exists():
        legacy_portfolios = [p for p in PORTFOLIOS_ROOT.iterdir() if p.name != "users"]
    legacy_user = [USER_DATA_ROOT / n for n in LEGACY_USER_ITEMS if (USER_DATA_ROOT / n).exists()]

    if not legacy_portfolios and not legacy_user:
        _write_marker({"admin_id": None, "moved": [], "skipped": [], "note": "nothing to migrate"})
        return None

    if admin_id is None:
        from src.api.user_middleware import find_first_admin_id

        try:
            admin_id = find_first_admin_id()
        except Exception as e:
            logger.warning(f"Legacy data migration postponed (admin lookup failed): {e}")
            return None
    if not admin_id:
        logger.warning("Legacy data migration postponed: no ADMIN user found yet")
        return None

    moved: list[str] = []
    skipped: list[str] = []
    dest_portfolios = portfolios_dir(admin_id)
    for item in legacy_portfolios:
        _move(item, dest_portfolios / item.name, moved, skipped)
    dest_user = user_data_dir(admin_id)
    for item in legacy_user:
        _move(item, dest_user / item.name, moved, skipped)

    summary = {"admin_id": admin_id, "moved": moved, "skipped": skipped}
    _write_marker(summary)
    logger.info(f"Legacy data migrated to admin {admin_id}: {len(moved)} moved, {len(skipped)} skipped")
    for line in moved + skipped:
        logger.info(f"  {line}")
    return summary


def _write_marker(summary: dict) -> None:
    MARKER_FILE.parent.mkdir(parents=True, exist_ok=True)
    summary = {**summary, "migrated_at": datetime.now(timezone.utc).isoformat()}
    MARKER_FILE.write_text(json.dumps(summary, indent=2), encoding="utf-8")
