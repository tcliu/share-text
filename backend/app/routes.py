from __future__ import annotations

import hashlib
import threading
import time
from collections import OrderedDict
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from .config import MODEL_DIR
from .engines import (
    PIPER_AVAILABLE,
    SUPPORTED_LANGS,
    configured_default_voices,
    get_engine,
    invalidate_engine,
    piper_lang_available,
    piper_voices_available,
    register_voice,
    remove_voice,
    resolve_default_voice,
    set_default_voice,
)
from .logging import get_request_ip, log_event
from .settings import get_tts_max_segment_length

# --- audio LRU cache ---------------------------------------------------------

_SYNTHESIS_CACHE_LIMIT = 1000
_synthesis_cache: OrderedDict[str, bytes] = OrderedDict()
_synthesis_cache_lock = threading.Lock()


def _cache_key(text: str, lang: str, voice: str | None = None) -> str:
    return hashlib.sha256(f"{lang}\0{voice or ''}\0{text}".encode()).hexdigest()


def _cache_get(key: str) -> bytes | None:
    with _synthesis_cache_lock:
        audio = _synthesis_cache.get(key)
        if audio is not None:
            _synthesis_cache.move_to_end(key)
        return audio


def _cache_put(key: str, audio: bytes) -> None:
    with _synthesis_cache_lock:
        _synthesis_cache[key] = audio
        _synthesis_cache.move_to_end(key)
        while len(_synthesis_cache) > _SYNTHESIS_CACHE_LIMIT:
            _synthesis_cache.popitem(last=False)


def _voice_state() -> dict:
    return {
        "languages": SUPPORTED_LANGS,
        "voices": {lang: piper_voices_available(lang, str(MODEL_DIR)) for lang in SUPPORTED_LANGS},
        "defaultVoices": configured_default_voices(str(MODEL_DIR)),
    }


def _sanitize_filename(filename: str | None) -> str:
    if not filename:
        raise HTTPException(status_code=400, detail="Missing upload filename")
    name = Path(filename).name
    if name != filename or name in {"", ".", ".."}:
        raise HTTPException(status_code=400, detail="Invalid upload filename")
    return name

router = APIRouter(prefix="/api")


class SynthesizeBody(BaseModel):
    text: str
    lang: str = "en"
    voice: str | None = None
    segment_index: int | None = None
    index_start: int | None = None
    index_end: int | None = None


def segment_log_details(body: SynthesizeBody) -> dict:
    details: dict = {}
    for field in ("segment_index", "index_start", "index_end"):
        value = getattr(body, field)
        if value is not None:
            details[field] = value
    return details


def request_log_details(body: SynthesizeBody) -> dict:
    details = segment_log_details(body)
    if body.voice:
        details["voice"] = body.voice
    return details


@router.get("/capabilities")
def get_capabilities() -> dict:
    return {
        "engines": {
            "piper": {
                "available": PIPER_AVAILABLE,
                "reason": None if PIPER_AVAILABLE else "piper-tts is not installed",
            },
        },
        "languages": SUPPORTED_LANGS,
        "voices": {lang: piper_voices_available(lang, str(MODEL_DIR)) for lang in SUPPORTED_LANGS},
        "defaultVoices": configured_default_voices(str(MODEL_DIR)),
    }


@router.get("/admin/voices")
def get_admin_voices() -> dict:
    return _voice_state()


class DefaultVoicesBody(BaseModel):
    default_voices: dict[str, str | None] = {}


@router.put("/admin/voices/defaults")
def update_admin_voice_defaults(body: DefaultVoicesBody) -> dict:
    for lang, voice in body.default_voices.items():
        try:
            set_default_voice(lang, voice.strip() if isinstance(voice, str) and voice.strip() else None, str(MODEL_DIR))
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _voice_state()


@router.post("/admin/voices")
async def upload_admin_voice(
    lang: str = Form(...),
    model: UploadFile = File(...),
    config: UploadFile = File(...),
) -> dict:
    if lang not in SUPPORTED_LANGS:
        raise HTTPException(status_code=422, detail=f"Unknown language '{lang}'. Supported: {SUPPORTED_LANGS}")
    model_name = _sanitize_filename(model.filename)
    config_name = _sanitize_filename(config.filename)
    if not model_name.endswith(".onnx"):
        raise HTTPException(status_code=400, detail="Model filename must end with .onnx")
    if config_name != f"{model_name}.json":
        raise HTTPException(status_code=400, detail="Config filename must match <model>.json")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODEL_DIR / model_name
    config_path = MODEL_DIR / config_name
    if model_path.exists() or config_path.exists():
        raise HTTPException(status_code=409, detail="A voice with that filename already exists")
    model_path.write_bytes(await model.read())
    config_path.write_bytes(await config.read())
    try:
        register_voice(lang, model_name, str(MODEL_DIR))
        invalidate_engine(str(MODEL_DIR))
    except Exception:
        model_path.unlink(missing_ok=True)
        config_path.unlink(missing_ok=True)
        raise
    return _voice_state()


@router.delete("/admin/voices")
def delete_admin_voice(lang: str, voice: str) -> dict:
    if lang not in SUPPORTED_LANGS:
        raise HTTPException(status_code=422, detail=f"Unknown language '{lang}'. Supported: {SUPPORTED_LANGS}")
    if voice not in piper_voices_available(lang, str(MODEL_DIR)):
        raise HTTPException(status_code=404, detail=f"Unknown voice '{voice}' for language '{lang}'")
    (MODEL_DIR / voice).unlink(missing_ok=True)
    (MODEL_DIR / f"{voice}.json").unlink(missing_ok=True)
    remove_voice(lang, voice, str(MODEL_DIR))
    invalidate_engine(str(MODEL_DIR))
    return _voice_state()


@router.post("/synthesize")
def synthesize(request: Request, body: SynthesizeBody) -> Response:
    ip = get_request_ip(request)
    started_at = time.monotonic()
    text = body.text.strip()
    lang = body.lang.strip()
    log_event(
        ip=ip,
        action="tts_synthesize_start",
        details={"lang": lang, "text_size": len(text), "engine": "piper", **segment_log_details(body)},
    )
    if not text:
        log_event(
            ip=ip,
            action="tts_synthesize_error",
            details={
                "error": "Text must not be empty",
                "elapsed_ms": round((time.monotonic() - started_at) * 1000),
                **request_log_details(body),
            },
        )
        raise HTTPException(status_code=422, detail="Text must not be empty")
    max_length = get_tts_max_segment_length()
    if len(text) > max_length:
        log_event(
            ip=ip,
            action="tts_synthesize_error",
            details={
                **request_log_details(body),
                "error": f"Text exceeds the maximum segment length of {max_length} characters",
                "elapsed_ms": round((time.monotonic() - started_at) * 1000),
            },
        )
        raise HTTPException(
            status_code=422,
            detail=f"Text exceeds the maximum segment length of {max_length} characters",
        )
    if lang not in SUPPORTED_LANGS:
        log_event(
            ip=ip,
            action="tts_synthesize_error",
            details={
                "lang": lang,
                "error": f"Unknown language '{lang}'. Supported: {SUPPORTED_LANGS}",
                "elapsed_ms": round((time.monotonic() - started_at) * 1000),
                **request_log_details(body),
            },
        )
        raise HTTPException(status_code=422, detail=f"Unknown language '{lang}'. Supported: {SUPPORTED_LANGS}")
    if not PIPER_AVAILABLE:
        log_event(
            ip=ip,
            action="tts_synthesize_error",
            details={
                "lang": lang,
                "error": "piper-tts is not installed",
                "elapsed_ms": round((time.monotonic() - started_at) * 1000),
                **request_log_details(body),
            },
        )
        raise HTTPException(status_code=503, detail="piper-tts is not installed")
    if not piper_lang_available(lang, str(MODEL_DIR)):
        log_event(
            ip=ip,
            action="tts_synthesize_error",
            details={
                "lang": lang,
                "error": f"No TTS engine available for the requested language '{lang}'",
                "elapsed_ms": round((time.monotonic() - started_at) * 1000),
                **request_log_details(body),
            },
        )
        raise HTTPException(status_code=503, detail=f"No TTS engine available for the requested language '{lang}'")
    available_voices = piper_voices_available(lang, str(MODEL_DIR))
    if body.voice and body.voice not in available_voices:
        log_event(
            ip=ip,
            action="tts_synthesize_error",
            details={
                "lang": lang,
                "voice": body.voice,
                "error": f"Unknown voice '{body.voice}' for language '{lang}'",
                "elapsed_ms": round((time.monotonic() - started_at) * 1000),
                **request_log_details(body),
            },
        )
        raise HTTPException(
            status_code=422,
            detail=f"Unknown voice '{body.voice}' for language '{lang}'",
        )

    resolved_voice = body.voice or resolve_default_voice(lang, str(MODEL_DIR))

    # --- cache check --------------------------------------------------------
    key = _cache_key(text, lang, resolved_voice)
    cached_audio = _cache_get(key)
    if cached_audio is not None:
        log_event(
            ip=ip,
            action="tts_synthesize_end",
            details={
                "lang": lang,
                "engine": "piper",
                "model": "cache",
                "text_size": len(text),
                "elapsed_ms": round((time.monotonic() - started_at) * 1000),
                "cache": "hit",
                **request_log_details(body),
            },
        )
        return Response(content=cached_audio, media_type="audio/wav")

    # --- synthesize ---------------------------------------------------------
    try:
        engine = get_engine(str(MODEL_DIR))
    except RuntimeError as exc:
        log_event(
            ip=ip,
            action="tts_synthesize_error",
            details={
                "lang": lang,
                "error": str(exc),
                "elapsed_ms": round((time.monotonic() - started_at) * 1000),
                **request_log_details(body),
            },
        )
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    try:
        audio = engine.speak(text, lang, resolved_voice)
    except ValueError as exc:
        log_event(
            ip=ip,
            action="tts_synthesize_error",
            details={
                "lang": lang,
                "error": str(exc),
                "elapsed_ms": round((time.monotonic() - started_at) * 1000),
                **request_log_details(body),
            },
        )
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (RuntimeError, OSError) as exc:
        log_event(
            ip=ip,
            action="tts_synthesize_error",
            details={
                "lang": lang,
                "error": str(exc),
                "elapsed_ms": round((time.monotonic() - started_at) * 1000),
                **request_log_details(body),
            },
        )
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    _cache_put(key, audio)

    log_event(
        ip=ip,
        action="tts_synthesize_end",
        details={
            "lang": lang,
            "engine": "piper",
            "model": engine.model_name(lang, resolved_voice),
            "text_size": len(text),
            "elapsed_ms": round((time.monotonic() - started_at) * 1000),
            "cache": "miss",
            **request_log_details(body),
        },
    )

    return Response(content=audio, media_type="audio/wav")
