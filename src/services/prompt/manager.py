#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Unified Prompt Manager - Single source of truth for all prompt loading.

Prompts are English-only YAML files at src/agents/<module>/prompts/<agent>.yaml.
"""

from pathlib import Path
from typing import Any

import yaml

from src.services.config import PROJECT_ROOT


class PromptManager:
    """Unified prompt manager with singleton pattern and global caching."""

    _instance: "PromptManager | None" = None
    _cache: dict[str, dict[str, Any]] = {}

    def __new__(cls) -> "PromptManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def load_prompts(self, module_name: str, agent_name: str) -> dict[str, Any]:
        """
        Load prompts for an agent.

        Args:
            module_name: Module name (chat, interview, job_suggest, resume_writer)
            agent_name: Agent name (filename without .yaml)

        Returns:
            Loaded prompt configuration dictionary ({} if the file is missing)
        """
        cache_key = self._build_cache_key(module_name, agent_name)
        if cache_key not in self._cache:
            self._cache[cache_key] = self._load(module_name, agent_name)
        return self._cache[cache_key]

    @staticmethod
    def _build_cache_key(module_name: str, agent_name: str) -> str:
        return f"{module_name}_{agent_name}"

    @staticmethod
    def prompt_path(module_name: str, agent_name: str) -> Path:
        return PROJECT_ROOT / "src" / "agents" / module_name / "prompts" / f"{agent_name}.yaml"

    def _load(self, module_name: str, agent_name: str) -> dict[str, Any]:
        prompt_file = self.prompt_path(module_name, agent_name)
        if not prompt_file.exists():
            print(f"Warning: No prompt file found for {module_name}/{agent_name}")
            return {}
        try:
            with open(prompt_file, encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        except Exception as e:
            print(f"Warning: Failed to load {prompt_file}: {e}")
            return {}

    def get_prompt(
        self,
        prompts: dict[str, Any],
        section: str,
        field: str | None = None,
        fallback: str = "",
    ) -> str:
        """
        Safely get prompt from loaded configuration.

        Args:
            prompts: Loaded prompt dictionary
            section: Top-level section name
            field: Optional nested field name
            fallback: Default value if not found

        Returns:
            Prompt string or fallback
        """
        if section not in prompts:
            return fallback

        value = prompts[section]

        if field is None:
            return value if isinstance(value, str) else fallback

        if isinstance(value, dict) and field in value:
            result = value[field]
            return result if isinstance(result, str) else fallback

        return fallback

    def clear_cache(self, module_name: str | None = None) -> None:
        """
        Clear cached prompts.

        Args:
            module_name: If provided, only clear cache for this module
        """
        if module_name:
            keys_to_remove = [k for k in self._cache if k.startswith(f"{module_name}_")]
            for key in keys_to_remove:
                del self._cache[key]
        else:
            self._cache.clear()

    def reload_prompts(self, module_name: str, agent_name: str) -> dict[str, Any]:
        """Force reload prompts, bypassing cache."""
        self._cache.pop(self._build_cache_key(module_name, agent_name), None)
        return self.load_prompts(module_name, agent_name)


# Global singleton instance
_prompt_manager: PromptManager | None = None


def get_prompt_manager() -> PromptManager:
    """Get the global PromptManager instance."""
    global _prompt_manager
    if _prompt_manager is None:
        _prompt_manager = PromptManager()
    return _prompt_manager


__all__ = ["PromptManager", "get_prompt_manager"]
