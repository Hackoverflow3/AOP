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
                # Cooldown between rooms to avoid LLM rate limits
                if i > 0:
                    await asyncio.sleep(30)

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

            # All rooms complete
            db_queries.update_session_status(conn, session_id, "done")
            yield {"event": "session_done"}

        except Exception as e:
            db_queries.update_session_status(conn, session_id, "failed")
            yield {"event": "error", "content": str(e)}

    finally:
        conn.close()
