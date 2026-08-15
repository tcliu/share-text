from __future__ import annotations

import os
from pathlib import Path

MODEL_DIR = Path(os.environ.get("TTS_MODEL_DIR", "models"))
