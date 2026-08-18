from __future__ import annotations

import io
import threading
import wave
from pathlib import Path

try:
    from piper import PiperVoice

    PIPER_AVAILABLE = True
except Exception:
    PiperVoice = None  # type: ignore[assignment,misc]
    PIPER_AVAILABLE = False

PIPER_VOICES: dict[str, str] = {
    "en": "en_US-lessac-medium.onnx",
    "en_gb": "en_GB-alba-medium.onnx",
    "zh": "zh_CN-huayan-medium.onnx",
    "ja": "tsukuyomi-chan-6lang-fp16.onnx",
}

PIPER_LANG_ID: dict[str, int | None] = {
    "ja": 0,
    "en": None,
    "en_gb": None,
    "zh": None,
}

PIPER_LANGS: list[str] = list(PIPER_VOICES)
SUPPORTED_LANGS: list[str] = sorted(PIPER_LANGS)


def piper_lang_available(lang: str, model_dir: str) -> bool:
    """True when the piper voice for a language can actually be loaded."""
    if lang not in PIPER_VOICES:
        return False
    base = Path(model_dir) / PIPER_VOICES[lang]
    return base.is_file() and Path(f"{base}.json").is_file()


class PiperEngine:
    def __init__(self, model_dir: str) -> None:
        self._model_dir = model_dir
        self._voices: dict[str, object] = {}
        self._lock = threading.Lock()

    def model_name(self, lang: str) -> str:
        if lang not in PIPER_VOICES:
            raise ValueError(f"Unknown language '{lang}'. Supported: {PIPER_LANGS}")
        return PIPER_VOICES[lang]

    def speak(self, text: str, lang: str) -> bytes:
        if lang not in PIPER_VOICES:
            raise ValueError(f"Unknown language '{lang}'. Supported: {PIPER_LANGS}")
        voice = self._load_voice(lang)
        lang_id = PIPER_LANG_ID.get(lang)
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            if lang_id is not None:
                voice.synthesize(text, wav_file, language_id=lang_id)
            else:
                voice.synthesize_wav(text, wav_file)
        return buffer.getvalue()

    def _load_voice(self, lang: str) -> object:
        voice = self._voices.get(lang)
        if voice is not None:
            return voice
        with self._lock:
            voice = self._voices.get(lang)
            if voice is None:
                voice_path = f"{self._model_dir}/{PIPER_VOICES[lang]}"
                self._voices[lang] = PiperVoice.load(voice_path)
            return self._voices[lang]


_ENGINES: dict[str, PiperEngine] = {}
_ENGINES_LOCK = threading.Lock()


def get_engine(model_dir: str) -> PiperEngine:
    if not PIPER_AVAILABLE:
        raise RuntimeError("piper-tts is not installed. Run: pip install piper-tts")
    engine = _ENGINES.get(model_dir)
    if engine is not None:
        return engine
    with _ENGINES_LOCK:
        engine = _ENGINES.get(model_dir)
        if engine is None:
            engine = PiperEngine(model_dir)
            _ENGINES[model_dir] = engine
        return engine
