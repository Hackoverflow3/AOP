import sqlite3
import os
from pathlib import Path
from app.config import settings

SCHEMA = Path(__file__).parent / "schema.sql"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.database_url, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    os.makedirs(settings.artifacts_dir, exist_ok=True)
    conn = get_conn()
    conn.executescript(SCHEMA.read_text())
    conn.commit()
    conn.close()
