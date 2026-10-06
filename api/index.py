"""Vercel entrypoint: serves the FastAPI backend as a Python function under /api."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

# Only /tmp is writable on Vercel; set DATABASE_URL to Postgres for persistence.
os.environ.setdefault("DATABASE_URL", "sqlite:////tmp/yerevan.db")

from app.db import init_db  # noqa: E402
from app.main import app  # noqa: E402,F401

# Serverless runtimes don't reliably run ASGI startup events.
init_db()
