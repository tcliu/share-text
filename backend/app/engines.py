from __future__ import annotations

import io
import tempfile
import threading
import wave
from pathlib import Path

try:
    from piper import PiperVoice

    PIPER_AVAILABLE = True
except Exception:
    PiperVoice = None  # type: ignore[assignment,misc]
    PIPER_AVAILABLE = False

try:
    from gtts import gTTS

    GTTS_AVAILABLE = True
except Exception:
    gTTS = None  # type: ignore[assignment,misc]
    GTTS_AVAILABLE = False

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

GTTS_LANG_MAP: dict[str, str] = {
    "en": "en",
    "en_gb": "en",
    "zh": "zh-CN",
    "ja": "ja",
    "yue": "zh-CN",
}

PIPER_LANGS: list[str] = list(PIPER_VOICES)
GTTS_LANGS: list[str] = list(GTTS_LANG_MAP)
SUPPORTED_LANGS: list[str] = sorted(set(PIPER_LANGS) | set(GTTS_LANGS))


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


class GTTSEngine:
    def speak(self, text: str, lang: str) -> bytes:
        if lang not in GTTS_LANG_MAP:
            raise ValueError(f"Unknown language '{lang}'. Supported: {GTTS_LANGS}")
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
            temp_path = temp_file.name
        try:
            gTTS(text=text, lang=GTTS_LANG_MAP[lang]).save(temp_path)
            with open(temp_path, "rb") as audio_file:
                return audio_file.read()
        finally:
            Path(temp_path).unlink(missing_ok=True)


_ENGINES: dict[tuple[str, str], PiperEngine | GTTSEngine] = {}
_ENGINES_LOCK = threading.Lock()


def get_engine(name: str, model_dir: str) -> PiperEngine | GTTSEngine:
    if name == "piper":
        if not PIPER_AVAILABLE:
            raise RuntimeError("piper-tts is not installed. Run: pip install piper-tts")
    elif name == "gtts":
        if not GTTS_AVAILABLE:
            raise RuntimeError("gtts is not installed. Run: pip install gtts")
    else:
        raise ValueError(f"Unknown engine '{name}'. Supported: piper, gtts")

    key = (name, model_dir)
    engine = _ENGINES.get(key)
    if engine is not None:
        return engine
    with _ENGINES_LOCK:
        engine = _ENGINES.get(key)
        if engine is None:
            if name == "piper":
                engine = PiperEngine(model_dir)
            else:
                engine = GTTSEngine()
            _ENGINES[key] = engine
        return engine