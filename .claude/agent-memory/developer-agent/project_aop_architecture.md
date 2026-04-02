---
name: AOP project architecture
description: Key structural facts about the Autonomous Office Protocol project at /Users/abhisekmohapatra/Desktop/aop
type: project
---

The AOP project is a multi-agent system with a FastAPI backend.

**Why:** Agents collaborate in "rooms" (A, B, C, D) to scope, design, implement, and validate work. Each agent has a persona with a dedicated system prompt.

**How to apply:** When touching agent code, always load system prompts from `/Users/abhisekmohapatra/Desktop/aop/prompts/<name>.md`. Path resolution from any agent file: `Path(__file__).parent.parent.parent.parent / "prompts" / "<name>.md"` (agents/ -> app/ -> backend/ -> aop/ -> prompts/).

## Agent room_id assignments
- DirectorAgent: room_id = "A"
- CatalystAgent: room_id = "B"
- ArchitectAgent: room_id = "C"
- DevAgent: room_id = "C"

## LLM routing
All rooms (A, B, C, D) route to Groq (llama-3.3-70b-versatile) with Gemini (gemini-2.0-flash) as fallback. Entry point: `app.llm.client.complete(room_id, messages)`.

## Agent base contract
- BaseAgent is an ABC at `/Users/abhisekmohapatra/Desktop/aop/backend/app/agents/base.py`
- `respond(self, context: str, history: list[dict]) -> str` is `async`
- Subclasses add optional `room_id: str = None` param to `respond()` for per-call override

## Room class contract (Phase 3, implemented 2026-04-01)
- BaseRoom now requires `db_conn: sqlite3.Connection` and `event_queue: asyncio.Queue` in `__init__`
- `run(session_id, task, prior_context="")` is the standard signature for all rooms
- Every agent turn: append to shared `history` list, insert_message to DB, put "message" event on queue
- After artifact saved: insert_artifact to DB, put "artifact_ready" event on queue
- update_room_run called at end with status="done", llm_calls=seq (turn count)
- Room A ignores prior_context; Rooms B, C, D consume it
- TheForge (Room C) strips markdown code fences from Dev reply before json.loads validation; saves raw on failure but keeps filename as TECHNICAL_SPEC_V1.json

## Orchestrator wiring (Phase 4, implemented 2026-04-01)
- `orchestrator/runner.py`: `run_session(session_id)` is an **async generator** (no task arg — fetches from DB itself). Drives rooms A→B→C→D in sequence, drains asyncio.Queue per room, accumulates artifacts in `collected_artifacts: dict[str, str]`.
- `orchestrator/handshake.py`: `build_handshake_context(session_id, artifacts) -> str` formats prior artifacts; returns "" when dict is empty so Room A gets no context.
- `routers/runner.py`: `GET /{session_id}` wraps `orchestrator_run_session(session_id)` in a StreamingResponse with `media_type="text/event-stream"`. Each event is `f"data: {json.dumps(event)}\n\n"`.
- `db/init.py`: `get_conn()` now runs `PRAGMA journal_mode=WAL` on every connection (required for concurrent reads during streaming).
- Session status lifecycle: pending → running (before first room) → done or failed (after last room or on exception).
- Room tasks are run with `asyncio.create_task(room.run(...))` while the generator drains the queue with `queue.get_nowait()` / `asyncio.sleep(0.05)` polling.

## Frontend wiring (Phase 5, implemented 2026-04-01)
- `useSSE(sessionId)` in `lib/useSSE.ts`: returns `{ events, status, connected }`. `status` is `'connecting' | 'running' | 'done' | 'error'`. Resets on sessionId change.
- `SSEEvent.filename` is the canonical field for artifact filenames (supersedes legacy `artifact` field, kept for backwards compat).
- `Session` type has a `task: string` field.
- `lib/utils.ts` exports: `ROOM_NAMES`, `ROOM_ARTIFACTS`, `AGENT_COLORS`, `formatDate`.
- `StatusBar` component interface: `{ tokens: number, provider: string, room: string }` — does NOT expose status string directly; caller must derive a room label.
- `AgentBubble` interface: `{ text, agentColor, agentLabel }` — designed for thought clouds; reused in the message feed.
- All derived state in `run/[id]/page.tsx` uses `useMemo` over the `events` array — no separate `useState` per field.
- Landing page (`app/page.tsx`) routes new sessions to `/sessions/${id}` (not `/run/${id}`) — discrepancy with the run page route; do not change `page.tsx`.
- `next.config.js` rewrites `/api/:path*` → `http://localhost:8000/:path*`.
- SSE stream URL: `GET /api/run/{sessionId}` (proxied to FastAPI).
- Artifact download URL: `GET /api/artifacts/{sessionId}/download/{filename}`.
- ZIP download URL: `GET /api/artifacts/{sessionId}/zip`.

## Key paths
- Agents: `/Users/abhisekmohapatra/Desktop/aop/backend/app/agents/`
- Rooms: `/Users/abhisekmohapatra/Desktop/aop/backend/app/rooms/`
- LLM clients: `/Users/abhisekmohapatra/Desktop/aop/backend/app/llm/`
- System prompts: `/Users/abhisekmohapatra/Desktop/aop/prompts/`
- Artifact storage: `/Users/abhisekmohapatra/Desktop/aop/backend/app/artifacts/storage.py` — `save_artifact(session_id, filename, content) -> file_path`
- DB queries: `/Users/abhisekmohapatra/Desktop/aop/backend/app/db/queries.py`
