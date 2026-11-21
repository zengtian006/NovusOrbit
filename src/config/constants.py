#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Constants for NovusOrbit
"""

from pathlib import Path

# Project root directory - central location for all path calculations
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

# Standard log level tags (used in unified logging format)
LOG_LEVEL_TAGS = [
    "DEBUG",
    "INFO",
    "SUCCESS",
    "WARNING",
    "ERROR",
    "CRITICAL",
    "PROGRESS",
    "COMPLETE",
]
