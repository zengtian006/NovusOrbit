"""
Job Suggestion API Router
=========================

Generates personalized job recommendations by:
1. Analyzing the user's portfolio (resume/CV) via RAG
2. Scraping real job listings from Indeed & LinkedIn (MCP scrapers)
3. Using LLM to rank and analyze real jobs against the portfolio
"""

from pathlib import Path
import sys

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

project_root = Path(__file__).parent.parent.parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from src.agents.job_suggest import JobSuggestAgent, get_job_suggest_session_manager
from src.logging import get_logger
from src.services.config import load_config_with_main
from src.services.llm.config import get_llm_config
from src.services.settings.interface_settings import get_ui_language

# Initialize logger
config = load_config_with_main("solve_config.yaml", project_root)
log_dir = config.get("paths", {}).get("user_log_dir") or config.get("logging", {}).get("log_dir")
logger = get_logger("JobSuggestAPI", level="INFO", log_dir=log_dir)

router = APIRouter()


# === Request/Response Models ===


class SuggestJobsRequest(BaseModel):
    """Request to generate job suggestions from portfolio"""

    kb_name: str  # Portfolio KB name (required)
    count: int = 5
    role_type: str = ""  # Preferred role type
    location: str = ""  # Preferred location
    industry: str = ""  # Preferred industry
    experience_level: str = ""  # entry, mid, senior, lead
    language: str = ""


class JobDetailRequest(BaseModel):
    """Request for detailed analysis of a specific suggested job"""

    job_title: str
    company: str = ""
    company_type: str = ""
    job_url: str = ""
    job_description: str = ""
    kb_name: str = ""
    session_id: str = ""
    language: str = ""


class ScrapeJobDescriptionRequest(BaseModel):
    """Request to scrape full job description from a job URL"""

    url: str
    source: str = ""  # "Indeed" or "LinkedIn"


class SaveSessionRequest(BaseModel):
    """Request to save a job suggestion session"""

    session_id: str | None = None
    kb_name: str
    preferences: dict = {}
    suggestions: str = ""
    real_jobs: list = []
    search_queries: list = []
    count: int = 5
    portfolio_summary: str = ""


# Session manager singleton
session_manager = get_job_suggest_session_manager()


# === Helper ===


def _get_agent() -> JobSuggestAgent:
    """Create a JobSuggestAgent configured with the current LLM settings."""
    try:
        llm_config = get_llm_config()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM config error: {e!s}")

    ui_language = get_ui_language(default="en")

    return JobSuggestAgent(
        language=ui_language,
        api_key=llm_config.api_key,
        base_url=llm_config.base_url,
        model=llm_config.model,
        api_version=getattr(llm_config, "api_version", None),
        binding=getattr(llm_config, "binding", "openai"),
    )


# === API Endpoints ===


@router.post("/suggest")
async def suggest_jobs(request: SuggestJobsRequest):
    """
    Generate personalized job suggestions based on the user's portfolio.

    Flow:
    1. RAG extracts portfolio skills/experience
    2. LLM generates optimal search queries
    3. Indeed + LinkedIn scrapers fetch real job listings
    4. LLM ranks and analyzes real jobs against the portfolio

    Returns:
        Ranked job suggestions with real listings, match analysis, and apply URLs.
    """
    if not request.kb_name:
        raise HTTPException(status_code=400, detail="Portfolio KB name is required")

    try:
        agent = _get_agent()

        preferences = {}
        if request.role_type:
            preferences["role_type"] = request.role_type
        if request.location:
            preferences["location"] = request.location
        if request.industry:
            preferences["industry"] = request.industry
        if request.experience_level:
            preferences["experience_level"] = request.experience_level

        result = await agent.suggest_jobs(
            kb_name=request.kb_name,
            count=request.count,
            preferences=preferences,
        )

        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])

        logger.info(
            f"Generated job suggestions using portfolio: {request.kb_name} "
            f"(real_jobs={result.get('job_count', 0)}, "
            f"queries={result.get('search_queries', [])})"
        )

        return {
            "success": True,
            "suggestions": result["suggestions"],
            "real_jobs": result.get("real_jobs", []),
            "search_queries": result.get("search_queries", []),
            "portfolio_summary": result.get("portfolio_summary", ""),
            "used_portfolio": result["used_portfolio"],
            "used_job_search": result.get("used_job_search", False),
            "job_count": result.get("job_count", 0),
            "kb_name": request.kb_name,
            "preferences": preferences,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate job suggestions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/detail")
async def get_job_detail(request: JobDetailRequest):
    """
    Get detailed analysis for a specific job listing against the portfolio.

    Returns:
        In-depth match analysis with strengths, gaps, prep tips, and interview topics.
    """
    try:
        agent = _get_agent()

        result = await agent.get_job_detail(
            job_title=request.job_title,
            company=request.company,
            company_type=request.company_type,
            job_url=request.job_url,
            job_description=request.job_description,
            kb_name=request.kb_name,
        )

        # Save detail to session if session_id provided
        if request.session_id:
            session_manager.save_detail(
                session_id=request.session_id,
                job_title=request.job_title,
                analysis=result["analysis"],
            )

        logger.info(f"Generated detail analysis for: {request.job_title}")

        return {
            "success": True,
            "analysis": result["analysis"],
            "job_title": request.job_title,
            "used_portfolio": result["used_portfolio"],
            "used_web_search": result["used_web_search"],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate job detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Scrape Job Description ===


@router.post("/scrape-jd")
async def scrape_job_description(request: ScrapeJobDescriptionRequest):
    """
    Scrape the full job description from a job posting URL.

    Uses the appropriate scraper (Indeed or LinkedIn) based on the URL or source hint.

    Returns:
        Full job description text and metadata.
    """
    if not request.url:
        raise HTTPException(status_code=400, detail="Job URL is required")

    try:
        from src.mcp.scrapers.indeed import IndeedScraper
        from src.mcp.scrapers.linkedin import LinkedInScraper

        url = request.url
        source = (request.source or "").lower()

        result = {}
        scraper = None

        try:
            if "indeed.com" in url or source == "indeed":
                scraper = IndeedScraper()
                result = await scraper.get_job_details(url)
            elif "linkedin.com" in url or source == "linkedin":
                scraper = LinkedInScraper()
                result = await scraper.get_job_details(url)
            else:
                # Try both, prefer Indeed
                try:
                    scraper = IndeedScraper()
                    result = await scraper.get_job_details(url)
                except Exception:
                    if scraper:
                        await scraper.close()
                    scraper = LinkedInScraper()
                    result = await scraper.get_job_details(url)
        finally:
            if scraper:
                await scraper.close()

        if result.get("error"):
            logger.warning(f"Scrape JD warning: {result['error']}")

        return {
            "success": True,
            "full_description": result.get("full_description", ""),
            "title": result.get("title", ""),
            "company": result.get("company", ""),
            "location": result.get("location", ""),
            "employment_type": result.get("employment_type", ""),
            "salary": result.get("salary", ""),
            "url": url,
        }
    except Exception as e:
        logger.error(f"Failed to scrape job description: {e}")
        # Return empty description instead of failing - we can still add the job
        return {
            "success": True,
            "full_description": "",
            "title": "",
            "company": "",
            "location": "",
            "url": request.url,
            "warning": f"Could not scrape description: {str(e)}",
        }


# === Session Endpoints ===


@router.get("/sessions")
async def list_sessions(limit: int = 20):
    """List recent job suggestion sessions."""
    return session_manager.list_sessions(limit=limit, include_suggestions=False)


@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get a specific job suggestion session with full data."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("/sessions/save")
async def save_session(request: SaveSessionRequest):
    """Save or update a job suggestion session."""
    try:
        session = session_manager.save_session(
            session_id=request.session_id,
            kb_name=request.kb_name,
            preferences=request.preferences,
            suggestions=request.suggestions,
            count=request.count,
            portfolio_summary=request.portfolio_summary,
        )
        return {"success": True, "session_id": session["session_id"]}
    except Exception as e:
        logger.error(f"Failed to save job suggestion session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a job suggestion session."""
    if session_manager.delete_session(session_id):
        return {"success": True}
    raise HTTPException(status_code=404, detail="Session not found")


@router.get("/health")
async def health_check():
    """Health check"""
    return {"status": "healthy", "service": "job_suggest"}
