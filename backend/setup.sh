#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

is_setup_complete() {
  [ -x .venv/bin/uvicorn ]
}

run_setup() {
  PYTHON="${TTS_PYTHON:-python3}"
  if [ -x "$(command -v python3.12)" ]; then PYTHON=python3.12
  elif [ -x "$(command -v python3.11)" ]; then PYTHON=python3.11
  fi
  "$PYTHON" -m venv .venv
  ./.venv/bin/pip install --upgrade pip
  ./.venv/bin/pip install -r requirements.txt

  mkdir -p models
  MODEL_SOURCE="${TTS_MODEL_SOURCE:-../tts}"

  MODEL_FILES=(
    "en_US-lessac-medium.onnx"
    "en_GB-alba-medium.onnx"
    "zh_CN-huayan-medium.onnx"
    "tsukuyomi-chan-6lang-fp16.onnx"
  )

  for file in "${MODEL_FILES[@]}"; do
    if [ -f "${MODEL_SOURCE}/${file}" ]; then
      cp -n "${MODEL_SOURCE}/${file}" "models/"
    else
      echo "Warning: ${MODEL_SOURCE}/${file} not found"
    fi
    if [ -f "${MODEL_SOURCE}/${file}.json" ]; then
      cp -n "${MODEL_SOURCE}/${file}.json" "models/"
    fi
  done

  echo "Setup complete."
}

if [ "${1:-}" = "--check" ]; then
  if is_setup_complete; then
    exit 0
  fi
  exit 1
fi

run_setup