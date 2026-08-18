from __future__ import annotations

import json
from datetime import datetime, timezone

LEVEL_ACTIONS_ERROR = "_error"


def log_event(*, ip: str, action: str, details: dict | None = None) -> None:
    """Log an event in the same line format as the front-end app.

    Format: `<timestamp> <level> ip=<ip|unknown> action=<action> key="value" ...`
    `level` defaults to ERROR for `*_error` actions, else INFO; an explicit
    `level` key in `details` overrides it.
    """
    details = dict(details or {})
    timestamp = (
        datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    )
    default_level = "ERROR" if action.endswith(LEVEL_ACTIONS_ERROR) else "INFO"
    level = details.pop("level", default_level)
    serialized = " ".join(f"{key}={json.dumps(value)}" for key, value in details.items())
    line = f"{timestamp} {level} ip={ip or 'unknown'} action={action}"
    if serialized:
        line += f" {serialized}"
    print(line)


def get_request_ip(request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client is not None:
        return request.client.host
    return "unknown"