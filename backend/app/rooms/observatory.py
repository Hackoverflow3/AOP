# Room D — Observatory → FINAL_DELIVERY_REPORT.md
import uuid
from datetime import datetime

from app.rooms.base_room import BaseRoom
from app.agents.director import DirectorAgent
from app.artifacts import storage as artifact_storage
from app.db import queries as db


class Observatory(BaseRoom):
    room_id = "D"
    name = "Observatory"
    artifact_filename = "FINAL_DELIVERY_REPORT.md"

    async def run(self, session_id: str, task: str, prior_context: str = "") -> str:
        room_run_id = str(uuid.uuid4())
        db.create_room_run(self.db_conn, room_run_id, session_id, self.room_id, "groq")

        director = DirectorAgent()
        history: list[dict] = []
        seq = 0

        # Turn 1 — Director synthesises everything into FINAL_DELIVERY_REPORT.md
        ctx_director = (
            f"Task: {task}\n\n"
            f"All prior artifacts:\n{prior_context}\n\n"
            "You are in the Observatory. Synthesise all work into a FINAL_DELIVERY_REPORT.md. "
            "Include sections: Executive Summary, What Was Built, Technical Decisions, "
            "Risks & Mitigations, Next Steps, Appendix (links to artifacts)."
        )
        director_reply = await director.respond(ctx_director, [], room_id=self.room_id)
        history.append({"role": "assistant", "content": director_reply})
        seq += 1
        db.insert_message(self.db_conn, str(uuid.uuid4()), room_run_id, director.name, director_reply, seq)
        await self.event_queue.put({
            "event": "message",
            "room": self.room_id,
            "agent": director.name,
            "content": director_reply,
        })

        # Save artifact
        file_path = await artifact_storage.save_artifact(session_id, self.artifact_filename, director_reply)
        artifact_id = str(uuid.uuid4())
        db.insert_artifact(
            self.db_conn, artifact_id, session_id, room_run_id,
            self.room_id, self.artifact_filename, file_path,
        )
        await self.event_queue.put({
            "event": "artifact_ready",
            "room": self.room_id,
            "filename": self.artifact_filename,
        })

        # Finalise room_run
        db.update_room_run(
            self.db_conn, room_run_id, "done",
            datetime.utcnow().isoformat(), seq,
        )

        return director_reply
