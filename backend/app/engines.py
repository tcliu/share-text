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

# Voice registry: each language maps to the ordered list of voice model
# filenames it accepts. The first available voice for a language is its
# default; a request may override it with any other listed voice. Voices can
# be added by appending to the list and dropping the model files (`.onnx` +
# `.onnx.json`) in the MODEL_DIR.
PIPER_VOICES: dict[str, list[str]] = {
    "en": ["en_US-lessac-medium.onnx"],
    "en_gb": ["en_GB-alba-medium.onnx"],
    "zh": ["zh_CN-huayan-medium.onnx"],
    "ja": ["tsukuyomi-chan-6lang-fp16.onnx"],
    # Cantonese (Yue) model (drop-in model file must be placed in the MODEL_DIR).
    # The filename here is a placeholder; install a Cantonese/piper model with
    # this name or update it to match your model artifact.
    "yue": ["zh_HK-cantonese-medium.onnx"],
}

PIPER_LANGS: list[str] = list(PIPER_VOICES)
SUPPORTED_LANGS: list[str] = sorted(PIPER_LANGS)


def piper_voice_available(voice: str, model_dir: str) -> bool:
    """True when a specific piper voice can actually be loaded."""
    base = Path(model_dir) / voice
    return base.is_file() and Path(f"{base}.json").is_file()


def piper_lang_available(lang: str, model_dir: str) -> bool:
    """True when at least one piper voice for a language can be loaded."""
    if lang not in PIPER_VOICES:
        return False
    return any(piper_voice_available(voice, model_dir) for voice in PIPER_VOICES[lang])


def piper_voices_available(lang: str, model_dir: str) -> list[str]:
    """The voices for a language whose model files exist on disk."""
    if lang not in PIPER_VOICES:
        return []
    return [voice for voice in PIPER_VOICES[lang] if piper_voice_available(voice, model_dir)]


class PiperEngine:
    def __init__(self, model_dir: str) -> None:
        self._model_dir = model_dir
        self._voices: dict[str, object] = {}
        self._lock = threading.Lock()

    def model_name(self, lang: str, voice: str | None = None) -> str:
        return self._resolve_voice(lang, voice)

    def speak(self, text: str, lang: str, voice: str | None = None) -> bytes:
        resolved = self._resolve_voice(lang, voice)
        piper_voice = self._load_voice(resolved)
        # Map CJK fullwidth comma to ASCII comma so Piper inserts a pause.
        # ，(U+FF0C) is not recognized as a pause marker by the Chinese voice.
        # ASCII commas in numbers like "7,000" are unaffected.
        if lang == "zh":
            text = text.replace("\uff0c", ",")
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            # Piper writes 16-bit mono PCM at the model sample rate. Set the
            # header up front so a request that yields no audio chunks (e.g.
            # punctuation-only text) still closes as a valid empty WAV instead
            # of raising "# channels not specified".
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(piper_voice.config.sample_rate)
            piper_voice.synthesize_wav(text, wav_file, set_wav_format=False)
        return buffer.getvalue()

    def _resolve_voice(self, lang: str, voice: str | None) -> str:
        if lang not in PIPER_VOICES:
            raise ValueError(f"Unknown language '{lang}'. Supported: {PIPER_LANGS}")
        available = piper_voices_available(lang, self._model_dir)
        if voice and voice in available:
            return voice
        if available:
            return available[0]
        raise RuntimeError(f"No TTS engine available for the requested language '{lang}'")

    def _load_voice(self, voice: str) -> object:
        loaded = self._voices.get(voice)
        if loaded is not None:
            return loaded
        with self._lock:
            loaded = self._voices.get(voice)
            if loaded is None:
                voice_path = f"{self._model_dir}/{voice}"
                self._voices[voice] = PiperVoice.load(voice_path)
                loaded = self._voices[voice]
            return loaded


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
