"""Shared helpers for the admin scripts. Reads scripts/.env (never committed)."""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

ENV_PATH = Path(__file__).resolve().parent / ".env"


def env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        sys.exit(f"Missing {name} in {ENV_PATH}")
    return value


def admin_client() -> Client:
    """Client with the secret key. Bypasses RLS - local scripts only."""
    load_dotenv(ENV_PATH)
    return create_client(env("SUPABASE_URL"), env("SUPABASE_SECRET_KEY"))
