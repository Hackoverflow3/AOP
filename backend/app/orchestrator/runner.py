import asyncio
from typing import AsyncGenerator

from app.db.init import get_conn
import app.db.queries as db_queries
from app.orchestrator.handshake import build_handshake_context
from app.rooms.war_room import WarRoom
from app.rooms.hive import IdeationHive
from app.rooms.forge import TheForge
from app.rooms.observatory import Observatory

ROOM_ORDER = ["A", "B", "C", "D"]

ROOM_MAP = {
    "A": WarRoom,
    "B": IdeationHive,
    "C": TheForge,
    "D": Observatory,
}

COOLDOWN_SECONDS = 30

# ── Approval gate registry ────────────────────────────────────────────────────
# Maps session_id → asyncio.Event that the runner waits on.
_pending_approvals: dict[str, asyncio.Event] = {}
# Maps session_id → result dict {"approved": bool, "feedback": str}
_approval_results: dict[str, dict] = {}


async def _wait_for_approval(session_id: str) -> dict:
    """Block the runner until the user approves or rejects via the POST endpoint."""
    event = asyncio.Event()
    _pending_approvals[session_id] = event
    _approval_results.pop(session_id, None)
    await event.wait()
    result = _approval_results.pop(session_id, {"approved": True, "feedback": ""})
    _pending_approvals.pop(session_id, None)
    return result


def submit_approval(session_id: str, approved: bool, feedback: str = "") -> bool:
    """Called by the POST /sessions/{id}/approve endpoint to unblock the runner.

    Returns True if there was a pending approval to unblock, False otherwise.
    """
    event = _pending_approvals.get(session_id)
    if event is None:
        return False
    _approval_results[session_id] = {"approved": approved, "feedback": feedback}
    event.set()
    return True


async def run_session(session_id: str) -> AsyncGenerator[dict, None]:
    """
    Async generator that drives a full session through all 4 rooms in sequence,
    yielding SSE-ready event dicts as work progresses.

    Yields
    ------
    dict
        Event dicts with at minimum an "event" key.  Known shapes:
        - {"event": "room_enter",   "room": room_id}
        - {"event": "message",      "room": room_id, "agent": ..., "content": ...}
        - {"event": "artifact_ready","room": room_id, "filename": ...}
        - {"event": "room_done",    "room": room_id}
        - {"event": "session_done"}
        - {"event": "error",        "content": str}
    """
    conn = get_conn()
    try:
        # 1. Fetch session from DB
        session = db_queries.get_session(conn, session_id)
        if session is None:
            yield {"event": "error", "content": "Session not found"}
            return

        task = session["task"]

        # 2. Mark session running
        db_queries.update_session_status(conn, session_id, "running")

        collected_artifacts: dict[str, str] = {}

        try:
            for i, room_id in enumerate(ROOM_ORDER):
                # ── Cooldown between rooms ────────────────────────────────────
                if i > 0:
                    yield {
                        "event": "cooldown",
                        "duration": COOLDOWN_SECONDS,
                        "room": room_id,
                    }
                    await asyncio.sleep(COOLDOWN_SECONDS)

                # Signal entry into room
                yield {"event": "room_enter", "room": room_id}

                # Build context from rooms that have already completed
                prior_context = build_handshake_context(session_id, collected_artifacts)

                # Each room writes events into this queue
                queue: asyncio.Queue = asyncio.Queue()

                # Instantiate and launch room as a background task
                room = ROOM_MAP[room_id](db_conn=conn, event_queue=queue)
                room_task = asyncio.create_task(room.run(session_id, task, prior_context))

                # Drain the queue until the room task finishes and the queue is empty
                while not room_task.done() or not queue.empty():
                    try:
                        event = queue.get_nowait()
                        yield event
                    except asyncio.QueueEmpty:
                        await asyncio.sleep(0.05)

                # Propagate any exception raised inside the room task
                artifact_content = await room_task

                # Accumulate artifact for future rooms
                collected_artifacts[room_id] = artifact_content

                yield {"event": "room_done", "room": room_id}

                # ── Approval gate — pause until user approves ─────────────────
                yield {
                    "event": "awaiting_approval",
                    "room": room_id,
                    "approval_content": artifact_content[:4000],
                }
                approval = await _wait_for_approval(session_id)

                # If rejected, emit feedback as a system message and continue
                # (full retry logic is a future enhancement)
                if not approval["approved"] and approval.get("feedback"):
                    yield {
                        "event": "message",
                        "room": room_id,
                        "agent": "System",
                        "content": f"[Feedback from user]: {approval['feedback']}",
                    }

            # All rooms complete
            db_queries.update_session_status(conn, session_id, "done")
            yield {"event": "session_done"}

        except Exception as e:
            db_queries.update_session_status(conn, session_id, "failed")
            yield {"event": "error", "content": str(e)}

    finally:
        conn.close()
