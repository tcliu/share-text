from __future__ import annotations

from fastapi import FastAPI

from .routes import router

app = FastAPI(title="Share Text TTS")
app.include_router(router)