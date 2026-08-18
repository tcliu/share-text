from __future__ import annotations

import time

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel

from .config import MODEL_DIR
from .engines import (
    PIPER_AVAILABLE,
    SUPPORTED_LANGS,
    get_engine,
    piper_lang_available,
)
from .logging import get_request_ip, log_event

router = APIRouter(prefix="/api")


class SynthesizeBody(BaseModel):
    text: str
    lang: str = "en"


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
        "voices": {},
    }


@router.post("/synthesize")
def synthesize(request: Request, body: SynthesizeBody) -> Response:
    ip = get_request_ip(request)
    started_at = time.monotonic()
    text = body.text.strip()
    lang = body.lang.strip()
    log_event(
        ip=ip,
        action="tts_synthesize_start",
        details={"lang": lang, "text_size": len(text), "engine": "piper"},
    )
    if not text:
        log_event(
            ip=ip,
            action="tts_synthesize_error",
            details={"error": "Text must not be empty", "elapsed_ms": round((time.monotonic() - started_at) * 1000)},
        )
        raise HTTPException(status_code=422, detail="Text must not be empty")
    if lang not in SUPPORTED_LANGS:
        log_event(
            ip=ip,
            action="tts_synthesize_error",
            details={
                "lang": lang,
                "error": f"Unknown language '{lang}'. Supported: {SUPPORTED_LANGS}",
                "elapsed_ms": round((time.monotonic() - started_at) * 1000),
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
            },
        )
        raise HTTPException(status_code=503, detail=f"No TTS engine available for the requested language '{lang}'")

    try:
        engine = get_engine(str(MODEL_DIR))
    except RuntimeError as exc:
        log_event(
            ip=ip,
            action="tts_synthesize_error",
            details={"lang": lang, "error": str(exc), "elapsed_ms": round((time.monotonic() - started_at) * 1000)},
        )
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    try:
        audio = engine.speak(text, lang)
    except ValueError as exc:
        log_event(
            ip=ip,
            action="tts_synthesize_error",
            details={"lang": lang, "error": str(exc), "elapsed_ms": round((time.monotonic() - started_at) * 1000)},
        )
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (RuntimeError, OSError) as exc:
        log_event(
            ip=ip,
            action="tts_synthesize_error",
            details={"lang": lang, "error": str(exc), "elapsed_ms": round((time.monotonic() - started_at) * 1000)},
        )
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    log_event(
        ip=ip,
        action="tts_synthesize_end",
        details={
            "lang": lang,
            "engine": "piper",
            "model": engine.model_name(lang),
            "text_size": len(text),
            "elapsed_ms": round((time.monotonic() - started_at) * 1000),
        },
    )

    return Response(content=audio, media_type="audio/wav")
