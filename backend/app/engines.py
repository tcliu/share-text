from __future__ import annotations

import io
import json
import threading
import wave
from pathlib import Path

try:
    from piper import PiperVoice

    PIPER_AVAILABLE = True
except Exception:
    PiperVoice = None  # type: ignore[assignment,misc]
    PIPER_AVAILABLE = False

# Seed voice registry: each language starts with these accepted model
# filenames. Admin uploads extend a persisted registry stored beside MODEL_DIR.
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
REGISTRY_FILENAME = "_registry.json"


def _registry_path(model_dir: str) -> Path:
    return Path(model_dir) / REGISTRY_FILENAME


def _default_registry() -> dict[str, dict[str, list[str]] | dict[str, str]]:
    return {
        "voices": {lang: list(voices) for lang, voices in PIPER_VOICES.items()},
        "defaultVoices": {},
    }


def _read_registry(model_dir: str) -> dict[str, dict[str, list[str]] | dict[str, str]]:
    registry = _default_registry()
    path = _registry_path(model_dir)
    if not path.is_file():
        return registry
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return registry
    if isinstance(data, dict):
        voices = data.get("voices")
        if isinstance(voices, dict):
            normalized: dict[str, list[str]] = {lang: list(seed) for lang, seed in PIPER_VOICES.items()}
            for lang, entries in voices.items():
                if lang in PIPER_VOICES and isinstance(entries, list):
                    normalized[lang] = [voice for voice in entries if isinstance(voice, str) and voice]
            registry["voices"] = normalized
        defaults = data.get("defaultVoices")
        if isinstance(defaults, dict):
            registry["defaultVoices"] = {
                lang: voice
                for lang, voice in defaults.items()
                if lang in PIPER_VOICES and isinstance(voice, str) and voice
            }
    return registry


def _write_registry(model_dir: str, registry: dict[str, dict[str, list[str]] | dict[str, str]]) -> None:
    model_path = Path(model_dir)
    model_path.mkdir(parents=True, exist_ok=True)
    _registry_path(model_dir).write_text(json.dumps(registry, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def registered_voices(lang: str, model_dir: str) -> list[str]:
    if lang not in PIPER_VOICES:
        return []
    registry = _read_registry(model_dir)
    voices = registry.get("voices", {})
    entries = voices.get(lang) if isinstance(voices, dict) else None
    return list(entries) if isinstance(entries, list) else []


def configured_default_voices(model_dir: str) -> dict[str, str]:
    registry = _read_registry(model_dir)
    defaults = registry.get("defaultVoices", {})
    if not isinstance(defaults, dict):
        return {}
    return {lang: voice for lang, voice in defaults.items() if isinstance(lang, str) and isinstance(voice, str)}


def resolve_default_voice(lang: str, model_dir: str) -> str | None:
    if lang not in PIPER_VOICES:
        return None
    available = piper_voices_available(lang, model_dir)
    if not available:
        return None
    configured = configured_default_voices(model_dir).get(lang)
    if configured and configured in available:
        return configured
    return available[0]


def set_default_voice(lang: str, voice: str | None, model_dir: str) -> dict[str, str]:
    if lang not in PIPER_VOICES:
        raise ValueError(f"Unknown language '{lang}'. Supported: {PIPER_LANGS}")
    registry = _read_registry(model_dir)
    defaults = registry["defaultVoices"]
    if not isinstance(defaults, dict):
        raise ValueError("Invalid voice registry")
    if voice:
        if voice not in piper_voices_available(lang, model_dir):
            raise ValueError(f"Unknown voice '{voice}' for language '{lang}'")
        defaults[lang] = voice
    else:
        defaults.pop(lang, None)
    _write_registry(model_dir, registry)
    return configured_default_voices(model_dir)


def register_voice(lang: str, voice: str, model_dir: str) -> None:
    if lang not in PIPER_VOICES:
        raise ValueError(f"Unknown language '{lang}'. Supported: {PIPER_LANGS}")
    registry = _read_registry(model_dir)
    voices = registry["voices"]
    if not isinstance(voices, dict):
        raise ValueError("Invalid voice registry")
    entries = voices.get(lang)
    if not isinstance(entries, list):
        entries = []
        voices[lang] = entries
    if voice not in entries:
        entries.append(voice)
    _write_registry(model_dir, registry)


def remove_voice(lang: str, voice: str, model_dir: str) -> None:
    if lang not in PIPER_VOICES:
        raise ValueError(f"Unknown language '{lang}'. Supported: {PIPER_LANGS}")
    registry = _read_registry(model_dir)
    voices = registry["voices"]
    defaults = registry["defaultVoices"]
    if isinstance(voices, dict) and isinstance(voices.get(lang), list):
        voices[lang] = [item for item in voices[lang] if item != voice]
    if isinstance(defaults, dict) and defaults.get(lang) == voice:
        defaults.pop(lang, None)
    _write_registry(model_dir, registry)


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
    return [voice for voice in registered_voices(lang, model_dir) if piper_voice_available(voice, model_dir)]


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
        resolved_default = resolve_default_voice(lang, self._model_dir)
        if resolved_default:
            return resolved_default
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


def invalidate_engine(model_dir: str) -> None:
    with _ENGINES_LOCK:
        _ENGINES.pop(model_dir, None)
