from __future__ import annotations

import sqlite3
import time
from pathlib import Path

from .config import DATABASE_URL, SQLITE_PATH

CACHE_TTL_MS = 5000

_cache: dict[str, tuple[str, float]] = {}


def _read_sqlite(key: str) -> str | None:
    uri = Path(SQLITE_PATH).resolve().as_uri() + "?mode=ro"
    connection = sqlite3.connect(uri, uri=True, timeout=1.0)
    try:
        row = connection.execute("select value from app_config where key = ?", (key,)).fetchone()
        return row[0] if row is not None else None
    finally:
        connection.close()


def _read_postgres(key: str) -> str | None:
    try:
        import psycopg
    except ImportError:
        return None
    with psycopg.connect(DATABASE_URL, connect_timeout=2) as connection:
        row = connection.execute("select value from app_config where key = %s", (key,)).fetchone()
        return row[0] if row is not None else None


def get_app_config_value(key: str) -> str | None:
    """Read a single `app_config` row without creating or mutating anything.

    Prefers the Postgres `DATABASE_URL` when set, else the read-only SQLite
    database. The result is cached briefly; any failure (missing database,
    missing table, driver unavailable) resolves to `None` so the caller falls
    back to its environment/default, never crashes.
    """
    now = time.monotonic()
    cached = _cache.get(key)
    if cached is not None and (now - cached[1]) * 1000 < CACHE_TTL_MS:
        return cached[0]
    value: str | None = None
    try:
        if DATABASE_URL:
            value = _read_postgres(key)
        else:
            value = _read_sqlite(key)
    except Exception:
        value = None
    _cache[key] = (value, now)
    return value


def clear_settings_cache() -> None:
    _cache.clear()
