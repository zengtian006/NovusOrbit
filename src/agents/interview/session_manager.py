"""
InterviewSessionManager - Interview Prep session persistence and management.

Stores interview prep sessions (questions + answers) in a JSON file
at data/user/interview_sessions.json.
"""

import json
from pathlib import Path
import time
from typing import Any
import uuid


class InterviewSessionManager:
    """
    Manages persistent storage of interview prep sessions.

    Each session contains:
    - session_id: Unique identifier
    - job_title: Target job title
    - company: Target company
    - level: Difficulty level (easy/medium/hard)
    - questions: List of generated questions with optional answers
    - kb_name: Resume portfolio used
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

        self.sessions_file = self.base_dir / "interview_sessions.json"
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
        job_title: str,
        company: str,
        level: str,
        questions: list[dict[str, Any]],
        kb_name: str = "",
        job_description: str = "",
    ) -> dict[str, Any]:
        """Create or update an interview session."""
        now = time.time()
        sessions = self._get_sessions()

        if session_id:
            # Update existing
            for i, s in enumerate(sessions):
                if s.get("session_id") == session_id:
                    s["questions"] = questions
                    s["updated_at"] = now
                    s["kb_name"] = kb_name
                    # Move to front
                    sessions.pop(i)
                    sessions.insert(0, s)
                    self._save_sessions(sessions)
                    return s

        # Create new
        session_id = f"interview_{int(now * 1000)}_{uuid.uuid4().hex[:8]}"
        session = {
            "session_id": session_id,
            "job_title": job_title,
            "company": company,
            "level": level,
            "question_count": len(questions),
            "questions": questions,
            "kb_name": kb_name,
            "job_description": job_description[:500],
            "created_at": now,
            "updated_at": now,
        }

        sessions.insert(0, session)

        # Cap at 100 sessions
        if len(sessions) > 100:
            sessions = sessions[:100]

        self._save_sessions(sessions)
        return session

    def get_session(self, session_id: str) -> dict[str, Any] | None:
        for s in self._get_sessions():
            if s.get("session_id") == session_id:
                return s
        return None

    def list_sessions(
        self,
        limit: int = 20,
        include_questions: bool = False,
    ) -> list[dict[str, Any]]:
        sessions = self._get_sessions()[:limit]

        if not include_questions:
            return [
                {
                    "session_id": s.get("session_id"),
                    "job_title": s.get("job_title", ""),
                    "company": s.get("company", ""),
                    "level": s.get("level", "medium"),
                    "question_count": s.get("question_count", len(s.get("questions", []))),
                    "answered_count": sum(
                        1 for q in s.get("questions", []) if q.get("answer")
                    ),
                    "kb_name": s.get("kb_name", ""),
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
_manager: InterviewSessionManager | None = None


def get_interview_session_manager() -> InterviewSessionManager:
    global _manager
    if _manager is None:
        _manager = InterviewSessionManager()
    return _manager


__all__ = ["InterviewSessionManager", "get_interview_session_manager"]
