from __future__ import annotations

import os

from .db import get_app_config_value

TTS_MAX_SEGMENT_LENGTH_DEFAULT = 500
TTS_MAX_SEGMENT_LENGTH_MIN = 50
TTS_MAX_SEGMENT_LENGTH_MAX = 5000


def _read_number(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        parsed = int(str(value).strip().replace(",", ""))
    except ValueError:
        return None
    if parsed < TTS_MAX_SEGMENT_LENGTH_MIN or parsed > TTS_MAX_SEGMENT_LENGTH_MAX:
        return None
    return parsed


def get_tts_max_segment_length() -> int:
    """Resolve the runtime `tts_max_segment_length` prop for this request.

    Priority: `app_config` database value (when within the valid range) ->
    `TTS_MAX_SEGMENT_LENGTH` environment variable (same validation) ->
    the built-in default.
    """
    db_value = _read_number(get_app_config_value("tts_max_segment_length"))
    if db_value is not None:
        return db_value
    env_value = _read_number(os.environ.get("TTS_MAX_SEGMENT_LENGTH"))
    if env_value is not None:
        return env_value
    return TTS_MAX_SEGMENT_LENGTH_DEFAULT
