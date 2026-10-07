"""
JobSuggestSessionManager - Job Suggestion session persistence and management.

Stores job suggestion sessions (suggestions + details) in a JSON file
at data/user/job_suggest_sessions.json.
"""

import json
from pathlib import Path
import time
from typing import Any
import uuid


class JobSuggestSessionManager:
    """
    Manages persistent storage of job suggestion sessions.

    Each session contains:
    - session_id: Unique identifier
    - kb_name: Portfolio used for analysis
    - preferences: User preferences (role_type, location, etc.)
    - suggestions: Raw markdown suggestions from the agent
    - details: Per-job detailed analyses (keyed by job title)
    - created_at / updated_at: Timestamps
    """

    def __init__(self, base_dir: str | None = None):
        if base_dir is None:
            project_root = Path(__file__).resolve().parents[3]
            base_dir_path = project_root / "data" / "user"
        else:
            base_dir_path = Path(base_dir)

        self.base_dir = base_dir_path
        self.base_dir.mkdir(parents=True, exist_ok=True)

        self.sessions_file = self.base_dir / "job_suggest_sessions.json"
        self._ensure_file()

    def _ensure_file(self):
        if not self.sessions_file.exists():
            self._save_data({"version": "1.0", "sessions": []})

    def _load_data(self) -> dict[str, Any]:
        try:
            with open(self.sessions_file, encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {"version": "1.0", "sessions": []}

    def _save_data(self, data: dict[str, Any]):
        with open(self.sessions_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def _get_sessions(self) -> list[dict[str, Any]]:
        return self._load_data().get("sessions", [])

    def _save_sessions(self, sessions: list[dict[str, Any]]):
        data = self._load_data()
        data["sessions"] = sessions
        self._save_data(data)

    def save_session(
        self,
        session_id: str | None,
        kb_name: str,
        preferences: dict[str, str],
        suggestions: str,
        count: int = 5,
        portfolio_summary: str = "",
    ) -> dict[str, Any]:
        """Create or update a job suggestion session."""
        now = time.time()
        sessions = self._get_sessions()

        if session_id:
            for i, s in enumerate(sessions):
                if s.get("session_id") == session_id:
                    s["suggestions"] = suggestions
                    s["updated_at"] = now
                    s["kb_name"] = kb_name
                    s["preferences"] = preferences
                    sessions.pop(i)
                    sessions.insert(0, s)
                    self._save_sessions(sessions)
                    return s

        # Create new
        session_id = f"jobsuggest_{int(now * 1000)}_{uuid.uuid4().hex[:8]}"
        session = {
            "session_id": session_id,
            "kb_name": kb_name,
            "preferences": preferences,
            "suggestion_count": count,
            "suggestions": suggestions,
            "portfolio_summary": portfolio_summary[:300],
            "details": {},
            "created_at": now,
            "updated_at": now,
        }

        sessions.insert(0, session)

        # Cap at 50 sessions
        if len(sessions) > 50:
            sessions = sessions[:50]

        self._save_sessions(sessions)
        return session

    def save_detail(
        self,
        session_id: str,
        job_title: str,
        analysis: str,
    ) -> bool:
        """Save a detailed analysis for a specific job in a session."""
        sessions = self._get_sessions()
        for s in sessions:
            if s.get("session_id") == session_id:
                if "details" not in s:
                    s["details"] = {}
                s["details"][job_title] = {
                    "analysis": analysis,
                    "generated_at": time.time(),
                }
                s["updated_at"] = time.time()
                self._save_sessions(sessions)
                return True
        return False

    def get_session(self, session_id: str) -> dict[str, Any] | None:
        for s in self._get_sessions():
            if s.get("session_id") == session_id:
                return s
        return None

    def list_sessions(
        self,
        limit: int = 20,
        include_suggestions: bool = False,
    ) -> list[dict[str, Any]]:
        sessions = self._get_sessions()[:limit]

        if not include_suggestions:
            return [
                {
                    "session_id": s.get("session_id"),
                    "kb_name": s.get("kb_name", ""),
                    "preferences": s.get("preferences", {}),
                    "suggestion_count": s.get("suggestion_count", 0),
                    "detail_count": len(s.get("details", {})),
                    "created_at": s.get("created_at"),
                    "updated_at": s.get("updated_at"),
                }
                for s in sessions
            ]
        return sessions

    def delete_session(self, session_id: str) -> bool:
        sessions = self._get_sessions()
        original = len(sessions)
        sessions = [s for s in sessions if s.get("session_id") != session_id]
        if len(sessions) < original:
            self._save_sessions(sessions)
            return True
        return False


# Singleton
_manager: JobSuggestSessionManager | None = None


def get_job_suggest_session_manager() -> JobSuggestSessionManager:
    global _manager
    if _manager is None:
        _manager = JobSuggestSessionManager()
    return _manager


__all__ = ["JobSuggestSessionManager", "get_job_suggest_session_manager"]
