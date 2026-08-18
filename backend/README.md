# TTS backend

Local text-to-speech service for the Share Text **Read aloud** feature. A
minimal FastAPI app exposing the same contract the browser proxy expects
(`/api/capabilities`, `/api/synthesize`), backed by local
Piper neural voices (offline, en / en_GB / zh / ja).

## Setup

```bash
./setup.sh
```

This creates a `.venv`, installs `requirements.txt`, and copies the Piper
`.onnx` (and `.onnx.json`) model files from a source directory. The default
source is `../tts` (the sibling TTS project); override with
`TTS_MODEL_SOURCE=/some/dir ./setup.sh`. Models live in `models/`, which is
gitignored — they are too large to commit. `./setup.sh --check` exits 0 when
setup is complete (`.venv/bin/uvicorn` present) and non-zero otherwise; the
start script uses it to decide whether to prompt for setup.

Requires Python 3.11+ (3.12 recommended; `piper-tts` may not support 3.14).

## Run

```bash
./.venv/bin/uvicorn app.main:app --port 8000
```

or from the repo root: `npm run tts:start` (reads `TTS_PORT`/`TTS_HOST`
from `backend/.env`, overridden by `backend/.env.dev`).

Environment:

| Variable        | Default    | Purpose                        |
| --------------- | ---------- | ------------------------------ |
| `TTS_PORT`      | `8000`     | Port to listen on              |
| `TTS_HOST`      | `127.0.0.1`| Address to bind to             |
| `TTS_MODEL_DIR` | `models`   | Directory containing `.onnx`   |

## API

- `GET /api/capabilities` — available engine + supported languages.
- `POST /api/synthesize` — body `{ text, lang }`; returns the Piper audio
  **bytes** directly (`audio/wav`) — no file paths, no temp storage, so the
  service is stateless and safe to run multi-instance or on serverless hosts.
  A language is only usable when its Piper model files (`.onnx` + `.onnx.json`)
  exist in `TTS_MODEL_DIR`; otherwise the request returns 503.

Synthesis is fully in-memory: nothing is written to disk, so there is no
scratch directory to clean up.

## Notes

- The Share Text proxy (`/api/tts/*`) reads the service base URL from the
  `TTS_SERVICE_URL` server env var; point it here for local dev, e.g.
  `TTS_SERVICE_URL=http://127.0.0.1:8000`.
- The Piper engine is cached at the process level (`app/engines.py`): a single
  `PiperEngine` instance per model dir is reused across requests, and each
  loaded voice is kept in memory, so parallel `POST /api/synthesize` calls
  only load a model once instead of once per request. The share-text client
  already fires segment syntheses in parallel.
- The service has no auth. When hosting it publicly, restrict access (shared
  secret or IP allow-list) so strangers cannot use your synthesis.
- Synthesis requests are logged to stdout (`app/logging.py`) in the same line
  format as the front-end `logEvent`: `tts_synthesize_start` fires on entry
  carrying `lang`, `text_size`, `engine`; `tts_synthesize_end` carries `lang`,
  `engine`, `text_size`, `elapsed_ms`; failed requests log `tts_synthesize_error`
  with `error` and `elapsed_ms`.
