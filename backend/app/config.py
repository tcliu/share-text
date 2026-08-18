from __future__ import annotations

import os
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]

MODEL_DIR = Path(os.environ.get("TTS_MODEL_DIR", "models"))

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

_sqlite_path_env = os.environ.get("SQLITE_PATH")
if _sqlite_path_env:
    SQLITE_PATH = Path(_sqlite_path_env)
    if not SQLITE_PATH.is_absolute():
        SQLITE_PATH = ROOT_DIR / SQLITE_PATH
else:
    SQLITE_PATH = ROOT_DIR / ".data" / "share-text-dev.sqlite"
