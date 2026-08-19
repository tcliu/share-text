import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app import routes as routes_module
from app.routes import SynthesizeBody, get_capabilities, segment_log_details


def test_cache_key_is_deterministic():
    assert routes_module._cache_key("hi", "en") == routes_module._cache_key("hi", "en")
    assert routes_module._cache_key("hi", "en") != routes_module._cache_key("hi", "zh")
    assert routes_module._cache_key("hi", "en") != routes_module._cache_key(
        "hi", "en", "en_GB-alba-medium.onnx"
    )
    assert routes_module._cache_key("hi", "en", "en_US-lessac-medium.onnx") != routes_module._cache_key(
        "hi", "en", "en_GB-alba-medium.onnx"
    )


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


def test_capabilities_reports_available_voices_per_language(monkeypatch):
    monkeypatch.setattr(
        routes_module,
        "piper_voices_available",
        lambda lang, model_dir: ["en_US-lessac-medium.onnx"] if lang == "en" else [],
    )
    capabilities = get_capabilities()
    assert capabilities["voices"]["en"] == ["en_US-lessac-medium.onnx"]
    assert capabilities["voices"]["zh"] == []


def test_synthesize_rejects_unknown_voice(monkeypatch):
    monkeypatch.setattr(routes_module, "PIPER_AVAILABLE", True)
    monkeypatch.setattr(routes_module, "piper_lang_available", lambda lang, model_dir: True)
    monkeypatch.setattr(
        routes_module,
        "piper_voices_available",
        lambda lang, model_dir: ["en_US-lessac-medium.onnx"],
    )
    request = Request({"type": "http", "method": "POST", "path": "/api/synthesize", "headers": []})
    with pytest.raises(HTTPException) as exc:
        routes_module.synthesize(
            request,
            SynthesizeBody(text="hello", lang="en", voice="does-not-exist.onnx"),
        )
    assert exc.value.status_code == 422
    assert "Unknown voice" in str(exc.value.detail)


def test_synthesize_uses_the_requested_voice(monkeypatch):
    class FakeVoice:
        config = type("Config", (), {"sample_rate": 22050})()

    class FakeEngine:
        def model_name(self, lang, voice=None):
            return voice or "default.onnx"

        def speak(self, text, lang, voice=None):
            return b"audio-bytes"

    monkeypatch.setattr(routes_module, "PIPER_AVAILABLE", True)
    monkeypatch.setattr(routes_module, "piper_lang_available", lambda lang, model_dir: True)
    monkeypatch.setattr(
        routes_module,
        "piper_voices_available",
        lambda lang, model_dir: ["en_US-lessac-medium.onnx", "en_GB-alba-medium.onnx"],
    )
    monkeypatch.setattr(routes_module, "get_engine", lambda model_dir: FakeEngine())
    monkeypatch.setattr(
        routes_module,
        "_cache_get",
        lambda key: None,
    )
    monkeypatch.setattr(
        routes_module,
        "_cache_put",
        lambda key, audio: None,
    )
    request = Request({"type": "http", "method": "POST", "path": "/api/synthesize", "headers": []})
    response = routes_module.synthesize(
        request,
        SynthesizeBody(text="hello", lang="en", voice="en_GB-alba-medium.onnx"),
    )
    assert response.body == b"audio-bytes"
