from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from .config import MODEL_DIR
from .engines import (
    GTTS_AVAILABLE,
    GTTS_LANGS,
    PIPER_AVAILABLE,
    SUPPORTED_LANGS,
    get_engine,
    piper_lang_available,
)

router = APIRouter(prefix="/api")

ENGINE_EXTENSIONS = {"piper": ".wav", "gtts": ".mp3"}
AUDIO_MEDIA_TYPES = {".wav": "audio/wav", ".mp3": "audio/mpeg"}


class SynthesizeBody(BaseModel):
    text: str
    lang: str = "en"
    engine: str = "auto"
    voice: str | None = None


@router.get("/capabilities")
def get_capabilities() -> dict:
    return {
        "engines": {
            "piper": {
                "available": PIPER_AVAILABLE,
                "reason": None if PIPER_AVAILABLE else "piper-tts is not installed",
            },
            "gtts": {
                "available": GTTS_AVAILABLE,
                "reason": None if GTTS_AVAILABLE else "gtts is not installed",
            },
        },
        "languages": SUPPORTED_LANGS,
        "voices": {},
    }


def _resolve_engine(engine: str, lang: str) -> str:
    if engine == "auto":
        prefer_gtts = lang == "zh"
        if not prefer_gtts and PIPER_AVAILABLE and piper_lang_available(lang, str(MODEL_DIR)):
            return "piper"
        if GTTS_AVAILABLE and lang in GTTS_LANGS:
            return "gtts"
        if PIPER_AVAILABLE and piper_lang_available(lang, str(MODEL_DIR)):
            return "piper"
        raise HTTPException(status_code=503, detail="No TTS engine available for the requested language")
    if engine not in ("piper", "gtts"):
        raise HTTPException(status_code=422, detail=f"Unknown engine '{engine}'")
    return engine


@router.post("/synthesize")
def synthesize(body: SynthesizeBody) -> Response:
    text = body.text.strip()
    lang = body.lang.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Text must not be empty")
    if lang not in SUPPORTED_LANGS:
        raise HTTPException(status_code=422, detail=f"Unknown language '{lang}'. Supported: {SUPPORTED_LANGS}")
    if body.voice is not None and not body.voice.strip():
        raise HTTPException(status_code=422, detail="Voice must not be empty when provided")

    engine_name = _resolve_engine(body.engine, lang)
    try:
        engine = get_engine(engine_name, str(MODEL_DIR))
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    try:
        audio = engine.speak(text, lang)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (RuntimeError, OSError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    media_type = AUDIO_MEDIA_TYPES[ENGINE_EXTENSIONS[engine_name]]
    return Response(content=audio, media_type=media_type)