"""
Job Suggestion Module - AI-powered job recommendations based on user portfolio.

This module provides:
- JobSuggestAgent: Analyzes portfolio via RAG and suggests matching jobs
- Prompt templates for profile analysis and job suggestion generation
- RAG integration for portfolio-based personalization
- Web search for current job market data

Usage:
    from src.agents.job_suggest import JobSuggestAgent

    agent = JobSuggestAgent(language="en")
    suggestions = await agent.suggest_jobs(
        kb_name="my-cv",
        preferences={"role_type": "Software Engineer", "location": "Remote"},
    )
"""

from .job_suggest_agent import JobSuggestAgent
from .session_manager import JobSuggestSessionManager, get_job_suggest_session_manager

__all__ = ["JobSuggestAgent", "JobSuggestSessionManager", "get_job_suggest_session_manager"]
