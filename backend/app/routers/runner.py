import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.orchestrator.runner import run_session as orchestrator_run_session

router = APIRouter()


@router.get("/{session_id}")
async def run_session(session_id: str):
    """
    SSE endpoint.  Connects to the orchestrator and streams every event the
    runner yields as a Server-Sent Event frame consumed by the frontend useSSE hook.
    """

    async def event_stream():
        async for event in orchestrator_run_session(session_id):
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
