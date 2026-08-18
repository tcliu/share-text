import importlib

import pytest
import sqlite3


@pytest.fixture
def app_config_db(tmp_path, monkeypatch):
    import app.config as config
    import app.db as db

    db_path = tmp_path / "app_config.sqlite"
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("SQLITE_PATH", str(db_path))
    importlib.reload(config)
    importlib.reload(db)

    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "create table if not exists app_config "
        "(key text primary key, value text not null, updated_at text not null default 'now')"
    )
    conn.commit()
    conn.close()

    yield db, db_path

    db.clear_settings_cache()


def test_reads_app_config_value(app_config_db):
    db, db_path = app_config_db
    conn = sqlite3.connect(str(db_path))
    conn.execute("insert into app_config(key, value) values('tts_max_segment_length', '250')")
    conn.commit()
    conn.close()
    assert db.get_app_config_value("tts_max_segment_length") == "250"


def test_missing_key_returns_none(app_config_db):
    db, _ = app_config_db
    assert db.get_app_config_value("does_not_exist") is None


def test_cache_is_used_until_cleared(app_config_db):
    db, db_path = app_config_db
    conn = sqlite3.connect(str(db_path))
    conn.execute("insert into app_config(key, value) values('k', 'v')")
    conn.commit()
    conn.close()

    assert db.get_app_config_value("k") == "v"

    conn = sqlite3.connect(str(db_path))
    conn.execute("update app_config set value = 'v2' where key = 'k'")
    conn.commit()
    conn.close()

    # Value is served from cache until the cache is cleared.
    assert db.get_app_config_value("k") == "v"
    db.clear_settings_cache()
    assert db.get_app_config_value("k") == "v2"


def test_missing_database_returns_none_without_raising(tmp_path, monkeypatch):
    import app.config as config
    import app.db as db

    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("SQLITE_PATH", str(tmp_path / "missing.sqlite"))
    importlib.reload(config)
    importlib.reload(db)

    assert db.get_app_config_value("k") is None
    db.clear_settings_cache()
