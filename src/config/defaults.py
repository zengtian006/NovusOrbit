"""
Default configuration values for NovusOrbit.
"""

from pathlib import Path

# Get project root
_project_root = Path(__file__).parent.parent.parent

# Default configuration
DEFAULTS = {
    "llm": {"model": "gpt-4o-mini", "provider": "openai"},
    "paths": {
        "user_data_dir": str(_project_root / "data" / "user"),
        "portfolios_dir": str(_project_root / "data" / "portfolios"),
        "user_log_dir": str(_project_root / "logs"),
    },
}
