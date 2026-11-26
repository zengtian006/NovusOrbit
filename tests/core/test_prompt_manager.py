#!/usr/bin/env python
"""
Unit tests for the unified PromptManager.
"""

from pathlib import Path
import sys

import pytest

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from src.services.prompt import PromptManager, get_prompt_manager


class TestPromptManager:
    """Test cases for PromptManager."""

    def setup_method(self):
        """Reset singleton and cache before each test."""
        PromptManager._instance = None
        PromptManager._cache = {}

    def test_singleton_pattern(self):
        """Test that PromptManager uses singleton pattern."""
        pm1 = PromptManager()
        pm2 = PromptManager()
        assert pm1 is pm2

    def test_get_prompt_manager_returns_singleton(self):
        """Test that get_prompt_manager returns the same instance."""
        pm1 = get_prompt_manager()
        pm2 = get_prompt_manager()
        assert pm1 is pm2

    def test_load_prompts_interview_module(self):
        """Test loading prompts for interview module."""
        pm = get_prompt_manager()
        prompts = pm.load_prompts(
            module_name="interview",
            agent_name="interview_agent",
        )
        assert isinstance(prompts, dict)
        assert "question_system" in prompts

    def test_load_prompts_resume_writer_module(self):
        """Test loading prompts for resume writer module."""
        pm = get_prompt_manager()
        prompts = pm.load_prompts(
            module_name="resume_writer",
            agent_name="edit_agent",
        )
        assert isinstance(prompts, dict)
        assert prompts

    def test_load_prompts_chat_module(self):
        """Test loading prompts for chat module."""
        pm = get_prompt_manager()
        prompts = pm.load_prompts(
            module_name="chat",
            agent_name="chat_agent",
        )
        assert isinstance(prompts, dict)

    def test_caching(self):
        """Test that prompts are cached after first load."""
        pm = get_prompt_manager()

        # First load
        prompts1 = pm.load_prompts("interview", "interview_agent")

        # Second load should return cached version
        prompts2 = pm.load_prompts("interview", "interview_agent")

        assert prompts1 is prompts2

    def test_clear_cache_all(self):
        """Test clearing all cache."""
        pm = get_prompt_manager()

        # Load some prompts
        pm.load_prompts("interview", "interview_agent")
        pm.load_prompts("chat", "chat_agent")

        assert len(pm._cache) >= 2

        pm.clear_cache()
        assert len(pm._cache) == 0

    def test_clear_cache_module_specific(self):
        """Test clearing cache for specific module."""
        pm = get_prompt_manager()

        # Load prompts for multiple modules
        pm.load_prompts("interview", "interview_agent")
        pm.load_prompts("chat", "chat_agent")

        initial_count = len(pm._cache)

        # Clear only interview cache
        pm.clear_cache("interview")

        # Chat prompts should still be cached
        assert any(k.startswith("chat") for k in pm._cache)
        assert not any(k.startswith("interview") for k in pm._cache)

    def test_get_prompt_helper(self):
        """Test the get_prompt helper method."""
        pm = get_prompt_manager()

        test_prompts = {
            "system": {
                "role": "You are a helpful assistant",
                "task": "Answer questions",
            },
            "simple_key": "Simple value",
        }

        # Test nested access
        role = pm.get_prompt(test_prompts, "system", "role")
        assert role == "You are a helpful assistant"

        # Test simple access (no field)
        simple = pm.get_prompt(test_prompts, "simple_key")
        assert simple == "Simple value"

        # Test fallback
        missing = pm.get_prompt(test_prompts, "nonexistent", "field", "fallback_value")
        assert missing == "fallback_value"

    def test_missing_prompt_file_returns_empty_dict(self):
        """A missing prompt file returns {} instead of raising."""
        pm = get_prompt_manager()
        assert pm.load_prompts("interview", "does_not_exist") == {}

    def test_reload_prompts(self):
        """Test force reload bypasses cache."""
        pm = get_prompt_manager()

        # Load and cache
        prompts1 = pm.load_prompts("interview", "interview_agent")

        # Force reload
        prompts2 = pm.reload_prompts("interview", "interview_agent")

        # They should be equal but not the same object
        assert prompts1 == prompts2
        # After reload, cache should have fresh entry
        cache_key = "interview_interview_agent"
        assert cache_key in pm._cache


class TestPromptFiles:
    """Every agent's prompt file loads and is non-empty."""

    @pytest.mark.parametrize(
        "module_name,agent_name",
        [
            ("chat", "chat_agent"),
            ("interview", "interview_agent"),
            ("job_suggest", "job_suggest_agent"),
            ("resume_writer", "edit_agent"),
            ("resume_writer", "narrator_agent"),
        ],
    )
    def test_prompt_file_loads(self, module_name, agent_name):
        PromptManager._cache = {}
        prompts = get_prompt_manager().load_prompts(module_name, agent_name)
        assert prompts, f"{module_name}/{agent_name} prompts are empty"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
