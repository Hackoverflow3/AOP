# Room A — War Room → PROJECT_MANIFEST.md
import uuid
from datetime import datetime

from app.rooms.base_room import BaseRoom
from app.agents.director import DirectorAgent
from app.agents.catalyst import CatalystAgent
from app.artifacts import storage as artifact_storage
from app.db import queries as db


class WarRoom(BaseRoom):
    room_id = "A"
    name = "War Room"
    artifact_filename = "PROJECT_MANIFEST.md"

    async def run(self, session_id: str, task: str, prior_context: str = "") -> str:
        room_run_id = str(uuid.uuid4())
        db.create_room_run(self.db_conn, room_run_id, session_id, self.room_id, "groq")

        director = DirectorAgent()
        catalyst = CatalystAgent()
        history: list[dict] = []
        seq = 0

        # Turn 1 — Director opens
        ctx_director_open = (
            f"Task submitted: {task}\n\n"
            "Open the War Room. Announce your entry per protocol and begin scoping this task."
        )
        director_reply = await director.respond(ctx_director_open, [], room_id=self.room_id)
        history.append({"role": "assistant", "content": director_reply})
        seq += 1
        db.insert_message(self.db_conn, str(uuid.uuid4()), room_run_id, director.name, director_reply, seq)
        await self.event_queue.put({
            "event": "message",
            "room": self.room_id,
            "agent": director.name,
            "content": director_reply,
        })

        # Turn 2 — Catalyst challenges
        ctx_catalyst = (
            f"Director has scoped the task. Challenge it with 2 specific 'what if' risk scenarios.\n\n"
            f"Director said:\n{director_reply}"
        )
        catalyst_reply = await catalyst.respond(ctx_catalyst, [], room_id=self.room_id)
        history.append({"role": "assistant", "content": catalyst_reply})
        seq += 1
        db.insert_message(self.db_conn, str(uuid.uuid4()), room_run_id, catalyst.name, catalyst_reply, seq)
        await self.event_queue.put({
            "event": "message",
            "room": self.room_id,
            "agent": catalyst.name,
            "content": catalyst_reply,
        })

        # Turn 3 — Director responds to challenges and writes PROJECT_MANIFEST.md
        ctx_director_manifest = (
            f"Catalyst raised these challenges:\n{catalyst_reply}\n\n"
            "Respond to each challenge and produce the final PROJECT_MANIFEST.md artifact. "
            "Format it as a proper Markdown document with sections: "
            "Overview, Scope, Out of Scope, Risks, Success Criteria."
        )
        director_final = await director.respond(ctx_director_manifest, history, room_id=self.room_id)
        history.append({"role": "assistant", "content": director_final})
        seq += 1
        db.insert_message(self.db_conn, str(uuid.uuid4()), room_run_id, director.name, director_final, seq)
        await self.event_queue.put({
            "event": "message",
            "room": self.room_id,
            "agent": director.name,
            "content": director_final,
        })

        # Save artifact
        file_path = await artifact_storage.save_artifact(session_id, self.artifact_filename, director_final)
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

        return director_final
