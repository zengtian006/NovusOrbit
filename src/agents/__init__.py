"""
Agents Module - Unified agent system for NovusOrbit.

This module provides a unified BaseAgent class and module-specific agents:
- chat: Home chat assistant with session management
- interview: Interview question and answer generation
- job_suggest: Portfolio-based job recommendations (Indeed/LinkedIn scrapers)
- resume_writer: Resume editing and narration agents (EditAgent, NarratorAgent)

Usage:
    from src.agents.base_agent import BaseAgent

    class MyAgent(BaseAgent):
        async def process(self, *args, **kwargs):
            ...
"""

from .base_agent import BaseAgent
from .chat import ChatAgent, SessionManager

__all__ = ["BaseAgent", "ChatAgent", "SessionManager"]
