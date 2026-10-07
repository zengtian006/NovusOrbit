"""
Settings API Router (Simplified)
================================

Manages basic UI settings: theme, language, sidebar customization.
Configuration for LLM/Embedding/TTS/Search is handled by the unified config service.
"""

import json
import yaml
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# Settings file path for UI preferences (stored in settings folder with other configs)
SETTINGS_FILE = (
    Path(__file__).parent.parent.parent.parent / "data" / "user" / "settings" / "interface.json"
)

# Global page settings file
PAGE_SETTINGS_FILE = (
    Path(__file__).parent.parent.parent.parent / "config" / "page_settings.yaml"
)

# Default sidebar navigation order
DEFAULT_SIDEBAR_NAV_ORDER = {
    "essential": ["/", "/portfolio", "/jobs", "/history"],
    "advanced": ["/interview", "/job-suggest", "/resume-writer"],
}

# Route migrations: old route -> new route (for backward compatibility)
_ROUTE_MIGRATIONS = {
    "/knowledge": "/portfolio",
}


def _migrate_nav_order(nav_order: dict) -> dict:
    """Migrate old route names in saved nav order and ensure new routes exist."""
    def migrate_group(hrefs: list) -> list:
        return [_ROUTE_MIGRATIONS.get(h, h) for h in hrefs]
    
    # Handle backwards compatibility: support old "start"/"learnResearch" keys
    essential = nav_order.get("essential") or nav_order.get("start", [])
    advanced = nav_order.get("advanced") or nav_order.get("learnResearch", [])
    
    migrated = {
        "essential": migrate_group(essential),
        "advanced": migrate_group(advanced),
    }
    
    # Ensure /jobs is in essential if not already there
    if "/jobs" not in migrated["essential"]:
        try:
            idx = migrated["essential"].index("/portfolio") + 1
        except ValueError:
            idx = 1
        migrated["essential"].insert(idx, "/jobs")
    
    # Ensure advanced tools have critical routes
    advanced_routes = ["/interview", "/job-suggest", "/resume-writer"]
    for route in advanced_routes:
        if route not in migrated["advanced"] and route not in migrated["essential"]:
            migrated["advanced"].append(route)
    
    return migrated


def load_page_settings() -> dict:
    """Load global page settings from YAML config file."""
    if PAGE_SETTINGS_FILE.exists():
        try:
            with open(PAGE_SETTINGS_FILE, encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
                return data.get("pages", {})
        except Exception as e:
            print(f"Error loading page settings: {e}")
    
    # Default page settings if file not found
    return {
        "/": {"requireSSO": False},
        "/interview": {"requireSSO": True},
        "/job-suggest": {"requireSSO": True},
        "/jobs": {"requireSSO": False},
        "/portfolio": {"requireSSO": False},
        "/notebook": {"requireSSO": False},
        "/history": {"requireSSO": False},
        "/resume-writer": {"requireSSO": False},
        "/question": {"requireSSO": False},
        "/guide": {"requireSSO": False},
        "/ideagen": {"requireSSO": False},
        "/research": {"requireSSO": False},
    }


def save_page_settings(settings: dict):
    """Save global page settings to YAML config file."""
    PAGE_SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PAGE_SETTINGS_FILE, "w", encoding="utf-8") as f:
        yaml.dump({"pages": settings}, f, default_flow_style=False, allow_unicode=True)

# Default UI settings
DEFAULT_UI_SETTINGS = {
    "theme": "light",
    "language": "en",
    "sidebar_description": "✨ NovusOrbit",
    "sidebar_nav_order": DEFAULT_SIDEBAR_NAV_ORDER,
}


class SidebarNavOrder(BaseModel):
    essential: List[str]
    advanced: List[str]


class PageSettings(BaseModel):
    requireSSO: bool = False


class UISettings(BaseModel):
    theme: Literal["light", "dark"] = "light"
    language: Literal["zh", "en"] = "en"
    sidebar_description: Optional[str] = None
    sidebar_nav_order: Optional[SidebarNavOrder] = None


class ThemeUpdate(BaseModel):
    theme: Literal["light", "dark"]


class LanguageUpdate(BaseModel):
    language: Literal["zh", "en"]


class SidebarDescriptionUpdate(BaseModel):
    description: str


class SidebarNavOrderUpdate(BaseModel):
    nav_order: SidebarNavOrder


def load_ui_settings() -> dict:
    """Load UI-specific settings from json file"""
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, encoding="utf-8") as f:
                saved = json.load(f)
                return {**DEFAULT_UI_SETTINGS, **saved}
        except Exception:
            pass
    return DEFAULT_UI_SETTINGS.copy()


def save_ui_settings(settings: dict):
    """Save UI settings"""
    SETTINGS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)


@router.get("")
async def get_settings():
    """Get UI settings."""
    return {"ui": load_ui_settings()}


@router.put("/theme")
async def update_theme(update: ThemeUpdate):
    """Update UI theme"""
    current_ui = load_ui_settings()
    current_ui["theme"] = update.theme
    save_ui_settings(current_ui)
    return {"theme": update.theme}


@router.put("/language")
async def update_language(update: LanguageUpdate):
    """Update UI language"""
    current_ui = load_ui_settings()
    current_ui["language"] = update.language
    save_ui_settings(current_ui)
    return {"language": update.language}


@router.put("/ui")
async def update_ui_settings(update: UISettings):
    """Update all UI settings"""
    current_ui = load_ui_settings()
    update_dict = update.model_dump(exclude_none=True)
    current_ui.update(update_dict)
    save_ui_settings(current_ui)
    return current_ui


@router.post("/reset")
async def reset_settings():
    """Reset UI settings to default"""
    save_ui_settings(DEFAULT_UI_SETTINGS)
    return DEFAULT_UI_SETTINGS


@router.get("/themes")
async def get_themes():
    """Get available theme list"""
    return {
        "themes": [
            {"id": "light", "name": "Light"},
            {"id": "dark", "name": "Dark"},
        ]
    }


@router.get("/sidebar")
async def get_sidebar_settings():
    """Get sidebar customization settings"""
    current_ui = load_ui_settings()
    nav_order = current_ui.get("sidebar_nav_order", DEFAULT_UI_SETTINGS["sidebar_nav_order"])
    # Auto-migrate old routes (e.g., /knowledge -> /portfolio)
    nav_order = _migrate_nav_order(nav_order)
    return {
        "description": current_ui.get(
            "sidebar_description", DEFAULT_UI_SETTINGS["sidebar_description"]
        ),
        "nav_order": nav_order,
    }


@router.put("/sidebar/description")
async def update_sidebar_description(update: SidebarDescriptionUpdate):
    """Update sidebar description"""
    current_ui = load_ui_settings()
    current_ui["sidebar_description"] = update.description
    save_ui_settings(current_ui)
    return {"description": update.description}


@router.put("/sidebar/nav-order")
async def update_sidebar_nav_order(update: SidebarNavOrderUpdate):
    """Update sidebar navigation order"""
    current_ui = load_ui_settings()
    current_ui["sidebar_nav_order"] = update.nav_order.model_dump()
    save_ui_settings(current_ui)
    return {"nav_order": update.nav_order.model_dump()}


@router.get("/page")
async def get_page_settings():
    """Get global page-specific settings (e.g., SSO requirements)"""
    return load_page_settings()


@router.put("/page")
async def update_page_settings(update: dict):
    """Update global page-specific settings (e.g., SSO requirement)"""
    if "pageSettings" in update:
        save_page_settings(update["pageSettings"])
        return {"pageSettings": update["pageSettings"]}
    return load_page_settings()
