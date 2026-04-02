# All raw SQL lives here — routers/orchestrator import from this module only
import sqlite3


# ── sessions ──────────────────────────────────────────────────────────────────

def create_session(conn: sqlite3.Connection, id: str, title: str, task: str) -> None:
    from datetime import datetime
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO sessions (id, title, task, status, created_at, updated_at) "
        "VALUES (?, ?, ?, 'pending', ?, ?)",
        (id, title, task, now, now),
    )
    conn.commit()


def list_sessions(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM sessions ORDER BY created_at DESC"
    ).fetchall()
    return [dict(row) for row in rows]


def get_session(conn: sqlite3.Connection, session_id: str) -> dict | None:
    row = conn.execute(
        "SELECT * FROM sessions WHERE id = ?",
        (session_id,),
    ).fetchone()
    return dict(row) if row else None


def update_session_status(conn: sqlite3.Connection, session_id: str, status: str) -> None:
    from datetime import datetime
    now = datetime.utcnow().isoformat()
    conn.execute(
        "UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?",
        (status, now, session_id),
    )
    conn.commit()


# ── room_runs ─────────────────────────────────────────────────────────────────

def create_room_run(
    conn: sqlite3.Connection,
    id: str,
    session_id: str,
    room_id: str,
    llm_provider: str,
) -> None:
    from datetime import datetime
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO room_runs (id, session_id, room_id, status, started_at, llm_provider) "
        "VALUES (?, ?, ?, 'pending', ?, ?)",
        (id, session_id, room_id, now, llm_provider),
    )
    conn.commit()


def update_room_run(
    conn: sqlite3.Connection,
    id: str,
    status: str,
    completed_at: str,
    llm_calls: int,
) -> None:
    conn.execute(
        "UPDATE room_runs SET status = ?, completed_at = ?, llm_calls = ? WHERE id = ?",
        (status, completed_at, llm_calls, id),
    )
    conn.commit()


def get_room_runs(conn: sqlite3.Connection, session_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM room_runs WHERE session_id = ? ORDER BY started_at ASC",
        (session_id,),
    ).fetchall()
    return [dict(row) for row in rows]


# ── messages ──────────────────────────────────────────────────────────────────

def insert_message(
    conn: sqlite3.Connection,
    id: str,
    room_run_id: str,
    agent_name: str,
    content: str,
    sequence: int,
) -> None:
    from datetime import datetime
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO messages (id, room_run_id, agent_name, content, sequence, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (id, room_run_id, agent_name, content, sequence, now),
    )
    conn.commit()


def get_messages(conn: sqlite3.Connection, room_run_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM messages WHERE room_run_id = ? ORDER BY sequence ASC",
        (room_run_id,),
    ).fetchall()
    return [dict(row) for row in rows]


# ── artifacts ─────────────────────────────────────────────────────────────────

def insert_artifact(
    conn: sqlite3.Connection,
    id: str,
    session_id: str,
    room_run_id: str,
    room_id: str,
    filename: str,
    file_path: str,
) -> None:
    from datetime import datetime
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO artifacts (id, session_id, room_run_id, room_id, filename, file_path, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (id, session_id, room_run_id, room_id, filename, file_path, now),
    )
    conn.commit()


def get_artifacts(conn: sqlite3.Connection, session_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT * FROM artifacts WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,),
    ).fetchall()
    return [dict(row) for row in rows]
