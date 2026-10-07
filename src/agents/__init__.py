"""
Agents Module - Unified agent system for OpenTutor.

This module provides a unified BaseAgent class and module-specific agents:
- research: Deep research agents (DecomposeAgent, ResearchAgent, etc.)
- guide: Guided learning agents (ChatAgent, LocateAgent, etc.)
- ideagen: Idea generation agents (IdeaGenerationWorkflow, etc.)
- resume_writer: Resume writing agents (EditAgent, NarratorAgent)
- question: Question generation agents (ReAct architecture, separate base)
- chat: Lightweight conversational agent with session management

Usage:
    from src.agents.base_agent import BaseAgent

    class MyAgent(BaseAgent):
        async def process(self, *args, **kwargs):
            ...
"""

from .base_agent import BaseAgent
from .chat import ChatAgent, SessionManager

__all__ = ["BaseAgent", "ChatAgent", "SessionManager"]
