"""
Interview Prep API Router
=========================

Generates interview questions from job descriptions, with optional
RAG-based answers using the user's resume/portfolio and web search fallback.
"""

from pathlib import Path
import sys

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

project_root = Path(__file__).parent.parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from src.agents.interview import InterviewAgent, get_interview_session_manager
from src.logging import get_logger
from src.services.config import load_config_with_main
from src.services.llm.config import get_llm_config
from src.services.settings.interface_settings import get_ui_language

# Initialize logger
config = load_config_with_main("solve_config.yaml", project_root)
log_dir = config.get("paths", {}).get("user_log_dir") or config.get("logging", {}).get("log_dir")
logger = get_logger("InterviewAPI", level="INFO", log_dir=log_dir)

router = APIRouter()


# === Request/Response Models ===


class GenerateQuestionsRequest(BaseModel):
    """Request to generate interview questions"""

    job_title: str
    company: str = ""
    job_description: str
    level: str = "medium"  # easy, medium, hard
    count: int = 5
    language: str = ""  # auto-detect from UI settings if empty


class GenerateAnswerRequest(BaseModel):
    """Request to generate an answer for a specific question"""

    question: str
    job_title: str
    company: str = ""
    job_description: str = ""
    kb_name: str = ""  # user's resume portfolio
    language: str = ""


class GenerateBatchAnswersRequest(BaseModel):
    """Request to generate answers for multiple questions"""

    questions: list[str]
    job_title: str
    company: str = ""
    job_description: str = ""
    kb_name: str = ""
    language: str = ""


class SaveSessionRequest(BaseModel):
    """Request to save an interview prep session"""

    session_id: str | None = None
    job_title: str
    company: str = ""
    level: str = "medium"
    questions: list[dict] = []
    kb_name: str = ""
    job_description: str = ""


# Session manager singleton
interview_session_manager = get_interview_session_manager()


# === Helper ===


def _get_agent() -> InterviewAgent:
    """Create an InterviewAgent configured with the current LLM settings."""
    try:
        llm_config = get_llm_config()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM config error: {e!s}")

    ui_language = get_ui_language(default="en")

    return InterviewAgent(
        language=ui_language,
        api_key=llm_config.api_key,
        base_url=llm_config.base_url,
        model=llm_config.model,
        api_version=getattr(llm_config, "api_version", None),
        binding=getattr(llm_config, "binding", "openai"),
    )


# === API Endpoints ===


@router.post("/generate-questions")
async def generate_questions(request: GenerateQuestionsRequest):
    """
    Generate interview questions from a job description.

    Returns:
        List of generated questions with metadata.
    """
    try:
        agent = _get_agent()

        questions = await agent.generate_questions(
            job_title=request.job_title,
            company=request.company,
            job_description=request.job_description,
            level=request.level,
            count=request.count,
        )

        logger.info(f"Generated {len(questions)} {request.level} questions for: {request.job_title}")

        return {
            "success": True,
            "questions": questions,
            "job_title": request.job_title,
            "company": request.company,
            "level": request.level,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate questions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-answer")
async def generate_answer(request: GenerateAnswerRequest):
    """
    Generate a personalized answer for a single interview question,
    using RAG from the user's resume when available, with web search fallback.

    Returns:
        Generated answer with resume context and/or web search context.
    """
    try:
        agent = _get_agent()

        result = await agent.generate_answer(
            question=request.question,
            job_title=request.job_title,
            company=request.company,
            job_description=request.job_description,
            kb_name=request.kb_name,
        )

        return {
            "success": True,
            "answer": result["answer"],
            "question": request.question,
            "used_resume": result["used_resume"],
            "used_web_search": result["used_web_search"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate answer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-answers-batch")
async def generate_answers_batch(request: GenerateBatchAnswersRequest):
    """
    Generate personalized answers for multiple questions in batch.
    Uses resume RAG (once) + web search (per question).

    Returns:
        List of question-answer pairs.
    """
    try:
        agent = _get_agent()

        # Retrieve resume context once for all questions
        resume_context = ""
        if request.kb_name:
            from src.tools import rag_search

            try:
                rag_result = await rag_search(
                    query=f"Complete professional background, skills, experience, and achievements relevant to {request.job_title}",
                    kb_name=request.kb_name,
                    mode="hybrid",
                )
                resume_context = rag_result.get("answer", "")
                logger.info(f"RAG retrieved {len(resume_context)} chars of resume context for batch")
            except Exception as e:
                logger.warning(f"RAG search failed: {e}")

        results = []
        for i, question in enumerate(request.questions):
            try:
                result = await agent.generate_answer(
                    question=question,
                    job_title=request.job_title,
                    company=request.company,
                    job_description=request.job_description,
                    kb_name="",  # skip per-question RAG; use pre-fetched context
                    resume_context=resume_context,
                )
                results.append({
                    "question": question,
                    "answer": result["answer"],
                    "success": True,
                })
                logger.info(f"Generated answer {i + 1}/{len(request.questions)}")
            except Exception as e:
                logger.warning(f"Failed to generate answer for question {i + 1}: {e}")
                results.append({
                    "question": question,
                    "answer": "",
                    "success": False,
                    "error": str(e),
                })

        return {
            "success": True,
            "results": results,
            "total": len(results),
            "used_resume": bool(resume_context),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate batch answers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Session Endpoints ===


@router.get("/sessions")
async def list_interview_sessions(limit: int = 20):
    """List recent interview prep sessions."""
    return interview_session_manager.list_sessions(limit=limit, include_questions=False)


@router.get("/sessions/{session_id}")
async def get_interview_session(session_id: str):
    """Get a specific interview session with full questions & answers."""
    session = interview_session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/sessions/save")
async def save_interview_session(request: SaveSessionRequest):
    """Save or update an interview prep session."""
    try:
        session = interview_session_manager.save_session(
            session_id=request.session_id,
            job_title=request.job_title,
            company=request.company,
            level=request.level,
            questions=request.questions,
            kb_name=request.kb_name,
            job_description=request.job_description,
        )
        return {"success": True, "session_id": session["session_id"]}
    except Exception as e:
        logger.error(f"Failed to save interview session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sessions/{session_id}")
async def delete_interview_session(session_id: str):
    """Delete an interview session."""
    if interview_session_manager.delete_session(session_id):
        return {"success": True}
    raise HTTPException(status_code=404, detail="Session not found")


@router.get("/health")
async def health_check():
    """Health check"""
    return {"status": "healthy", "service": "interview"}
