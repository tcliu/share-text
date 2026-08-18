import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app import routes as routes_module
from app.routes import SynthesizeBody, segment_log_details


def test_cache_key_is_deterministic():
    assert routes_module._cache_key("en", "hi") == routes_module._cache_key("en", "hi")
    assert routes_module._cache_key("en", "hi") != routes_module._cache_key("zh", "hi")


def test_cache_put_get_and_lru_eviction():
    routes_module._cache_put("a", b"1")
    assert routes_module._cache_get("a") == b"1"
    assert routes_module._cache_get("missing") is None

    for i in range(routes_module._SYNTHESIS_CACHE_LIMIT + 5):
        routes_module._cache_put(f"k{i}", bytes([i % 256]))

    assert len(routes_module._synthesis_cache) <= routes_module._SYNTHESIS_CACHE_LIMIT
    # The oldest entry should have been evicted.
    assert routes_module._cache_get("a") is None


def test_segment_log_details_only_includes_set_fields():
    assert segment_log_details(SynthesizeBody(text="hi", lang="en")) == {}
    details = segment_log_details(
        SynthesizeBody(text="hi", lang="en", segment_index=1, index_start=0, index_end=2)
    )
    assert details == {"segment_index": 1, "index_start": 0, "index_end": 2}


def test_over_limit_request_is_rejected(monkeypatch):
    monkeypatch.setattr(routes_module, "get_tts_max_segment_length", lambda: 3)
    request = Request({"type": "http", "method": "POST", "path": "/api/synthesize", "headers": []})
    with pytest.raises(HTTPException) as exc:
        routes_module.synthesize(request, SynthesizeBody(text="x" * 10, lang="en"))
    assert exc.value.status_code == 422
