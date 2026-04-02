# Room C — The Forge → TECHNICAL_SPEC_V1.json
import json
import re
import uuid
from datetime import datetime

from app.rooms.base_room import BaseRoom
from app.agents.architect import ArchitectAgent
from app.agents.dev import DevAgent
from app.artifacts import storage as artifact_storage
from app.db import queries as db


def _strip_code_fences(text: str) -> str:
    """Remove markdown code fences (```json ... ``` or ``` ... ```) from a string."""
    # Strip leading/trailing whitespace first
    text = text.strip()
    # Remove ```json or ``` at start, then ``` at end
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```$", "", text)
    return text.strip()


class TheForge(BaseRoom):
    room_id = "C"
    name = "The Forge"
    artifact_filename = "TECHNICAL_SPEC_V1.json"

    async def run(self, session_id: str, task: str, prior_context: str = "") -> str:
        room_run_id = str(uuid.uuid4())
        db.create_room_run(self.db_conn, room_run_id, session_id, self.room_id, "groq")

        architect = ArchitectAgent()
        dev = DevAgent()
        history: list[dict] = []
        seq = 0

        # Turn 1 — Architect produces spec draft
        ctx_architect = (
            f"Task: {task}\n\n"
            f"Brainstorm Log:\n{prior_context}\n\n"
            "Produce a detailed technical specification as valid JSON. Include: "
            "system_overview, components (array with name/description/interfaces), "
            "data_models (array), api_endpoints (array with method/path/description), "
            "tech_stack, open_questions."
        )
        architect_reply = await architect.respond(ctx_architect, [], room_id=self.room_id)
        history.append({"role": "assistant", "content": architect_reply})
        seq += 1
        db.insert_message(self.db_conn, str(uuid.uuid4()), room_run_id, architect.name, architect_reply, seq)
        await self.event_queue.put({
            "event": "message",
            "room": self.room_id,
            "agent": architect.name,
            "content": architect_reply,
        })

        # Turn 2 — Dev reviews and outputs final corrected JSON
        ctx_dev = (
            f"Review this technical spec and output the FINAL corrected JSON only "
            f"(no markdown fences, pure JSON):\n\n{architect_reply}"
        )
        dev_reply = await dev.respond(ctx_dev, [], room_id=self.room_id)
        history.append({"role": "assistant", "content": dev_reply})
        seq += 1
        db.insert_message(self.db_conn, str(uuid.uuid4()), room_run_id, dev.name, dev_reply, seq)
        await self.event_queue.put({
            "event": "message",
            "room": self.room_id,
            "agent": dev.name,
            "content": dev_reply,
        })

        # Clean and validate JSON
        artifact_content = _strip_code_fences(dev_reply)
        save_filename = self.artifact_filename
        try:
            json.loads(artifact_content)
        except (json.JSONDecodeError, ValueError):
            # JSON invalid — save raw content but keep the declared filename
            artifact_content = dev_reply

        # Save artifact
        file_path = await artifact_storage.save_artifact(session_id, save_filename, artifact_content)
        artifact_id = str(uuid.uuid4())
        db.insert_artifact(
            self.db_conn, artifact_id, session_id, room_run_id,
            self.room_id, save_filename, file_path,
        )
        await self.event_queue.put({
            "event": "artifact_ready",
            "room": self.room_id,
            "filename": save_filename,
        })

        # Finalise room_run
        db.update_room_run(
            self.db_conn, room_run_id, "done",
            datetime.utcnow().isoformat(), seq,
        )

        return artifact_content
