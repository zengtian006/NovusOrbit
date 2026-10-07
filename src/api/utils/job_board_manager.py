"""
Job Board Manager - Manages user job listings and descriptions
All job board data is stored in user/jobs/ directory
"""

from enum import Enum
import json
from pathlib import Path
import time
import uuid

from pydantic import BaseModel


class JobStatus(str, Enum):
    """Job application status"""

    INTERESTED = "interested"
    APPLIED = "applied"
    INTERVIEWING = "interviewing"
    OFFERED = "offered"
    REJECTED = "rejected"
    SAVED = "saved"


class JobEntry(BaseModel):
    """Single job entry in a job board"""

    id: str
    title: str
    company: str
    description: str
    location: str = ""
    url: str = ""
    salary_range: str = ""
    status: str = "interested"
    notes: str = ""
    metadata: dict = {}
    created_at: float
    updated_at: float


class JobBoard(BaseModel):
    """Job board model (collection of jobs)"""

    id: str
    name: str
    description: str = ""
    created_at: float
    updated_at: float
    jobs: list[JobEntry] = []
    color: str = "#8B5CF6"  # Default purple
    icon: str = "briefcase"  # Default icon


class JobBoardManager:
    """Job board manager"""

    def __init__(self, base_dir: str | None = None):
        """
        Initialize job board manager

        Args:
            base_dir: Job board storage directory, defaults to project root/data/user/jobs
        """
        if base_dir is None:
            # Current file: NovusOrbit/src/api/utils/job_board_manager.py
            # Project root should be three levels up: NovusOrbit/
            project_root = Path(__file__).resolve().parents[3]
            base_dir_path = project_root / "data" / "user" / "jobs"
        else:
            base_dir_path = Path(base_dir)

        self.base_dir = base_dir_path
        self.base_dir.mkdir(parents=True, exist_ok=True)

        # Job board index file
        self.index_file = self.base_dir / "jobs_index.json"
        self._ensure_index()

    def _ensure_index(self):
        """Ensure index file exists"""
        if not self.index_file.exists():
            with open(self.index_file, "w", encoding="utf-8") as f:
                json.dump({"job_boards": []}, f, indent=2, ensure_ascii=False)

    def _load_index(self) -> dict:
        """Load index"""
        try:
            with open(self.index_file, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"job_boards": []}

    def _save_index(self, index: dict):
        """Save index"""
        with open(self.index_file, "w", encoding="utf-8") as f:
            json.dump(index, f, indent=2, ensure_ascii=False)

    def _get_board_file(self, board_id: str) -> Path:
        """Get job board file path"""
        return self.base_dir / f"{board_id}.json"

    def _load_board(self, board_id: str) -> dict | None:
        """Load single job board"""
        filepath = self._get_board_file(board_id)
        if not filepath.exists():
            return None
        try:
            with open(filepath, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    def _save_board(self, board: dict):
        """Save single job board"""
        filepath = self._get_board_file(board["id"])
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(board, f, indent=2, ensure_ascii=False)

    # === Job Board Operations ===

    def create_board(
        self, name: str, description: str = "", color: str = "#8B5CF6", icon: str = "briefcase"
    ) -> dict:
        """
        Create new job board

        Args:
            name: Board name
            description: Board description
            color: Color code
            icon: Icon name

        Returns:
            Created job board information
        """
        board_id = str(uuid.uuid4())[:8]
        now = time.time()

        board = {
            "id": board_id,
            "name": name,
            "description": description,
            "created_at": now,
            "updated_at": now,
            "jobs": [],
            "color": color,
            "icon": icon,
        }

        # Save board file
        self._save_board(board)

        # Update index
        index = self._load_index()
        index["job_boards"].append(
            {
                "id": board_id,
                "name": name,
                "description": description,
                "created_at": now,
                "updated_at": now,
                "job_count": 0,
                "color": color,
                "icon": icon,
            }
        )
        self._save_index(index)

        return board

    def list_boards(self) -> list[dict]:
        """
        List all job boards (summary information)

        Returns:
            Job board list
        """
        index = self._load_index()
        boards = []

        for board_info in index.get("job_boards", []):
            board = self._load_board(board_info["id"])
            if board:
                boards.append(
                    {
                        "id": board["id"],
                        "name": board["name"],
                        "description": board.get("description", ""),
                        "created_at": board["created_at"],
                        "updated_at": board["updated_at"],
                        "job_count": len(board.get("jobs", [])),
                        "color": board.get("color", "#8B5CF6"),
                        "icon": board.get("icon", "briefcase"),
                    }
                )

        # Sort by update time
        boards.sort(key=lambda x: x["updated_at"], reverse=True)
        return boards

    def get_board(self, board_id: str) -> dict | None:
        """
        Get job board details (includes all jobs)

        Args:
            board_id: Board ID

        Returns:
            Board details
        """
        return self._load_board(board_id)

    def update_board(
        self,
        board_id: str,
        name: str | None = None,
        description: str | None = None,
        color: str | None = None,
        icon: str | None = None,
    ) -> dict | None:
        """
        Update job board information

        Args:
            board_id: Board ID
            name: New name
            description: New description
            color: New color
            icon: New icon

        Returns:
            Updated board information
        """
        board = self._load_board(board_id)
        if not board:
            return None

        if name is not None:
            board["name"] = name
        if description is not None:
            board["description"] = description
        if color is not None:
            board["color"] = color
        if icon is not None:
            board["icon"] = icon

        board["updated_at"] = time.time()
        self._save_board(board)

        # Update index
        index = self._load_index()
        for board_info in index["job_boards"]:
            if board_info["id"] == board_id:
                if name is not None:
                    board_info["name"] = name
                if description is not None:
                    board_info["description"] = description
                if color is not None:
                    board_info["color"] = color
                if icon is not None:
                    board_info["icon"] = icon
                board_info["updated_at"] = board["updated_at"]
                break
        self._save_index(index)

        return board

    def delete_board(self, board_id: str) -> bool:
        """
        Delete job board

        Args:
            board_id: Board ID

        Returns:
            Whether deletion was successful
        """
        filepath = self._get_board_file(board_id)
        if not filepath.exists():
            return False

        # Delete file
        filepath.unlink()

        # Update index
        index = self._load_index()
        index["job_boards"] = [b for b in index["job_boards"] if b["id"] != board_id]
        self._save_index(index)

        return True

    # === Job Entry Operations ===

    def add_job(
        self,
        board_id: str,
        title: str,
        company: str,
        description: str,
        location: str = "",
        url: str = "",
        salary_range: str = "",
        status: str = "interested",
        notes: str = "",
        metadata: dict = None,
    ) -> dict | None:
        """
        Add a job entry to a board

        Args:
            board_id: Target board ID
            title: Job title
            company: Company name
            description: Job description
            location: Job location
            url: Job posting URL
            salary_range: Salary range
            status: Application status
            notes: Personal notes
            metadata: Additional metadata

        Returns:
            Added job entry information
        """
        board = self._load_board(board_id)
        if not board:
            return None

        job_id = str(uuid.uuid4())[:8]
        now = time.time()

        job = {
            "id": job_id,
            "title": title,
            "company": company,
            "description": description,
            "location": location,
            "url": url,
            "salary_range": salary_range,
            "status": status,
            "notes": notes,
            "metadata": metadata or {},
            "created_at": now,
            "updated_at": now,
        }

        board["jobs"].append(job)
        board["updated_at"] = now
        self._save_board(board)

        # Update index
        index = self._load_index()
        for board_info in index["job_boards"]:
            if board_info["id"] == board_id:
                board_info["updated_at"] = now
                board_info["job_count"] = len(board["jobs"])
                break
        self._save_index(index)

        return job

    def update_job(
        self,
        board_id: str,
        job_id: str,
        title: str | None = None,
        company: str | None = None,
        description: str | None = None,
        location: str | None = None,
        url: str | None = None,
        salary_range: str | None = None,
        status: str | None = None,
        notes: str | None = None,
        metadata: dict | None = None,
    ) -> dict | None:
        """
        Update a job entry

        Args:
            board_id: Board ID
            job_id: Job ID
            ... fields to update

        Returns:
            Updated job entry
        """
        board = self._load_board(board_id)
        if not board:
            return None

        for job in board["jobs"]:
            if job["id"] == job_id:
                if title is not None:
                    job["title"] = title
                if company is not None:
                    job["company"] = company
                if description is not None:
                    job["description"] = description
                if location is not None:
                    job["location"] = location
                if url is not None:
                    job["url"] = url
                if salary_range is not None:
                    job["salary_range"] = salary_range
                if status is not None:
                    job["status"] = status
                if notes is not None:
                    job["notes"] = notes
                if metadata is not None:
                    job["metadata"] = metadata
                job["updated_at"] = time.time()
                board["updated_at"] = job["updated_at"]
                self._save_board(board)

                # Update index
                index = self._load_index()
                for board_info in index["job_boards"]:
                    if board_info["id"] == board_id:
                        board_info["updated_at"] = board["updated_at"]
                        break
                self._save_index(index)

                return job

        return None

    def remove_job(self, board_id: str, job_id: str) -> bool:
        """
        Remove job from board

        Args:
            board_id: Board ID
            job_id: Job ID

        Returns:
            Whether deletion was successful
        """
        board = self._load_board(board_id)
        if not board:
            return False

        original_count = len(board["jobs"])
        board["jobs"] = [j for j in board["jobs"] if j["id"] != job_id]

        if len(board["jobs"]) == original_count:
            return False

        board["updated_at"] = time.time()
        self._save_board(board)

        # Update index
        index = self._load_index()
        for board_info in index["job_boards"]:
            if board_info["id"] == board_id:
                board_info["updated_at"] = board["updated_at"]
                board_info["job_count"] = len(board["jobs"])
                break
        self._save_index(index)

        return True

    def get_statistics(self) -> dict:
        """
        Get job board statistics

        Returns:
            Statistics information
        """
        boards = self.list_boards()

        total_jobs = 0
        status_counts = {
            "interested": 0,
            "applied": 0,
            "interviewing": 0,
            "offered": 0,
            "rejected": 0,
            "saved": 0,
        }

        for board_info in boards:
            board = self._load_board(board_info["id"])
            if board:
                for job in board.get("jobs", []):
                    total_jobs += 1
                    job_status = job.get("status", "interested")
                    if job_status in status_counts:
                        status_counts[job_status] += 1

        return {
            "total_boards": len(boards),
            "total_jobs": total_jobs,
            "jobs_by_status": status_counts,
            "recent_boards": boards[:5],
        }


# Global instance
job_board_manager = JobBoardManager()
