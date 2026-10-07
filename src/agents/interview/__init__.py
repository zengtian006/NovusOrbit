"""
Interview Prep Module - AI-powered interview question generation and answer coaching.

This module provides:
- InterviewAgent: Generates interview questions and personalized answers
- Prompt templates for question generation and answer crafting
- RAG integration for resume-based personalization
- Web search fallback for industry best practices

Usage:
    from src.agents.interview import InterviewAgent

    agent = InterviewAgent(language="en")
    questions = await agent.generate_questions(
        job_title="Software Engineer",
        company="Google",
        job_description="...",
        level="medium",
        count=5,
    )
    answer = await agent.generate_answer(
        question="Tell me about yourself",
        job_title="Software Engineer",
        kb_name="my-cv",
    )
"""

from .interview_agent import InterviewAgent
from .session_manager import InterviewSessionManager, get_interview_session_manager

__all__ = ["InterviewAgent", "InterviewSessionManager", "get_interview_session_manager"]
