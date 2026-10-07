"""
Jobs API Router
Provides job board creation, querying, updating, deletion, and job entry management functions
"""

from pathlib import Path
import sys
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Ensure module can be imported
project_root = Path(__file__).parent.parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from src.api.utils.job_board_manager import job_board_manager

router = APIRouter()


# === Request/Response Models ===


class CreateBoardRequest(BaseModel):
    """Create job board request"""

    name: str
    description: str = ""
    color: str = "#8B5CF6"
    icon: str = "briefcase"


class UpdateBoardRequest(BaseModel):
    """Update job board request"""

    name: str | None = None
    description: str | None = None
    color: str | None = None
    icon: str | None = None


class AddJobRequest(BaseModel):
    """Add job entry request"""

    title: str
    company: str
    description: str = ""
    location: str = ""
    url: str = ""
    salary_range: str = ""
    status: str = "interested"
    notes: str = ""
    metadata: dict = {}


class UpdateJobRequest(BaseModel):
    """Update job entry request"""

    title: str | None = None
    company: str | None = None
    description: str | None = None
    location: str | None = None
    url: str | None = None
    salary_range: str | None = None
    status: str | None = None
    notes: str | None = None
    metadata: dict | None = None


# === API Endpoints ===


@router.get("/list")
async def list_boards():
    """
    Get all job board list

    Returns:
        Job board list (includes summary information)
    """
    try:
        boards = job_board_manager.list_boards()
        return {"boards": boards, "total": len(boards)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/statistics")
async def get_statistics():
    """
    Get job board statistics

    Returns:
        Statistics information
    """
    try:
        stats = job_board_manager.get_statistics()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create")
async def create_board(request: CreateBoardRequest):
    """
    Create new job board

    Args:
        request: Create request

    Returns:
        Created job board information
    """
    try:
        board = job_board_manager.create_board(
            name=request.name,
            description=request.description,
            color=request.color,
            icon=request.icon,
        )
        return {"success": True, "board": board}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{board_id}")
async def get_board(board_id: str):
    """
    Get job board details

    Args:
        board_id: Board ID

    Returns:
        Board details (includes all jobs)
    """
    try:
        board = job_board_manager.get_board(board_id)
        if not board:
            raise HTTPException(status_code=404, detail="Job board not found")
        return board
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{board_id}")
async def update_board(board_id: str, request: UpdateBoardRequest):
    """
    Update job board information

    Args:
        board_id: Board ID
        request: Update request

    Returns:
        Updated board information
    """
    try:
        board = job_board_manager.update_board(
            board_id=board_id,
            name=request.name,
            description=request.description,
            color=request.color,
            icon=request.icon,
        )
        if not board:
            raise HTTPException(status_code=404, detail="Job board not found")
        return {"success": True, "board": board}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{board_id}")
async def delete_board(board_id: str):
    """
    Delete job board

    Args:
        board_id: Board ID

    Returns:
        Deletion result
    """
    try:
        success = job_board_manager.delete_board(board_id)
        if not success:
            raise HTTPException(status_code=404, detail="Job board not found")
        return {"success": True, "message": "Job board deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{board_id}/jobs")
async def add_job(board_id: str, request: AddJobRequest):
    """
    Add job entry to a board

    Args:
        board_id: Board ID
        request: Add job request

    Returns:
        Addition result
    """
    try:
        job = job_board_manager.add_job(
            board_id=board_id,
            title=request.title,
            company=request.company,
            description=request.description,
            location=request.location,
            url=request.url,
            salary_range=request.salary_range,
            status=request.status,
            notes=request.notes,
            metadata=request.metadata,
        )
        if not job:
            raise HTTPException(status_code=404, detail="Job board not found")
        return {"success": True, "job": job}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{board_id}/jobs/{job_id}")
async def update_job(board_id: str, job_id: str, request: UpdateJobRequest):
    """
    Update a job entry

    Args:
        board_id: Board ID
        job_id: Job ID
        request: Update request

    Returns:
        Updated job entry
    """
    try:
        job = job_board_manager.update_job(
            board_id=board_id,
            job_id=job_id,
            title=request.title,
            company=request.company,
            description=request.description,
            location=request.location,
            url=request.url,
            salary_range=request.salary_range,
            status=request.status,
            notes=request.notes,
            metadata=request.metadata,
        )
        if not job:
            raise HTTPException(status_code=404, detail="Job or board not found")
        return {"success": True, "job": job}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{board_id}/jobs/{job_id}")
async def remove_job(board_id: str, job_id: str):
    """
    Remove job from board

    Args:
        board_id: Board ID
        job_id: Job ID

    Returns:
        Deletion result
    """
    try:
        success = job_board_manager.remove_job(board_id, job_id)
        if not success:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"success": True, "message": "Job removed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Health check"""
    return {"status": "healthy", "service": "jobs"}
