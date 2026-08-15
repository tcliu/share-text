# TTS backend

Local text-to-speech service for the Share Text **Read aloud** feature. A
minimal FastAPI app exposing the same contract the browser proxy expects
(`/api/capabilities`, `/api/synthesize`), backed by local
Piper neural voices (offline, en / en_GB / zh / ja) with gTTS as a fallback
(en / en_GB / zh / ja / yue, requires internet).

## Setup

```bash
./setup.sh
```

This creates a `.venv`, installs `requirements.txt`, and copies the Piper
`.onnx` (and `.onnx.json`) model files from a source directory. The default
source is `../tts` (the sibling TTS project); override with
`TTS_MODEL_SOURCE=/some/dir ./setup.sh`. Models live in `models/`, which is
gitignored — they are too large to commit.

Requires Python 3.11+ (3.12 recommended; `piper-tts` may not support 3.14).

## Run

```bash
./.venv/bin/uvicorn app.main:app --port 8000
```

Environment:

| Variable        | Default    | Purpose                        |
| --------------- | ---------- | ------------------------------ |
| `TTS_MODEL_DIR` | `models`   | Directory containing `.onnx`   |

## API

- `GET /api/capabilities` — available engines + supported languages.
- `POST /api/synthesize` — body `{ text, lang, engine?, voice? }`
  (`engine` defaults to `auto`: Chinese (`zh`) prefers gTTS because Piper's
  zh voice reads Mandarin in short choppy groups, other languages prefer Piper
  when its model files exist in `TTS_MODEL_DIR`, falling back to gTTS
  otherwise — a missing voice degrades gracefully); returns the audio
  **bytes** directly (`audio/wav` for Piper, `audio/mpeg` for gTTS) — no file
  paths, no temp storage, so the service is stateless and safe to run
  multi-instance or on serverless hosts.

Synthesis is fully in-memory: nothing is written to disk, so there is no
scratch directory to clean up.

## Notes

- The Share Text proxy (`/api/tts/*`) reads the service base URL from the
  `TTS_SERVICE_URL` server env var; point it here for local dev, e.g.
  `TTS_SERVICE_URL=http://127.0.0.1:8000`.
- Engines are cached at the process level (`app/engines.py`): a single
  `PiperEngine` instance per model dir is reused across requests, and each
  loaded voice is kept in memory, so parallel `POST /api/synthesize` calls
  only load a model once instead of once per request. The share-text client
  already fires segment syntheses in parallel.
- The service has no auth. When hosting it publicly, restrict access (shared
  secret or IP allow-list) so strangers cannot use your synthesis.
