# Room B — Ideation Hive → BRAINSTORM_LOG.md
import uuid
from datetime import datetime

from app.rooms.base_room import BaseRoom
from app.agents.director import DirectorAgent
from app.agents.catalyst import CatalystAgent
from app.agents.architect import ArchitectAgent
from app.agents.dev import DevAgent
from app.artifacts import storage as artifact_storage
from app.db import queries as db


class IdeationHive(BaseRoom):
    room_id = "B"
    name = "Ideation Hive"
    artifact_filename = "BRAINSTORM_LOG.md"

    async def run(self, session_id: str, task: str, prior_context: str = "") -> str:
        room_run_id = str(uuid.uuid4())
        db.create_room_run(self.db_conn, room_run_id, session_id, self.room_id, "groq")

        director = DirectorAgent()
        catalyst = CatalystAgent()
        architect = ArchitectAgent()
        dev = DevAgent()
        history: list[dict] = []
        seq = 0

        # Turn 1 — Director opens / frames the problem
        ctx_director_open = (
            f"Task: {task}\n\n"
            f"Project Manifest:\n{prior_context}\n\n"
            "Open the Ideation Hive. Kick off brainstorming with the core problem framing."
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

        # Turn 2 — Catalyst challenges assumptions
        ctx_catalyst = (
            f"Director framed the problem:\n{director_reply}\n\n"
            "Challenge assumptions and add 2-3 wild card ideas."
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

        # Turn 3 — Architect proposes system shape
        ctx_architect = (
            f"After Director and Catalyst:\n{catalyst_reply}\n\n"
            "Propose the high-level system shape and key components."
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

        # Turn 4 — Dev assesses feasibility
        ctx_dev = (
            f"After Architect's proposal:\n{architect_reply}\n\n"
            "Assess feasibility and flag any implementation risks."
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

        # Turn 5 — Director synthesises into BRAINSTORM_LOG.md
        ctx_director_synth = (
            "Synthesise the full brainstorm into a BRAINSTORM_LOG.md. "
            "Include sections: Problem Framing, Wild Ideas, System Shape, Feasibility Notes, Key Decisions."
        )
        director_final = await director.respond(ctx_director_synth, history, room_id=self.room_id)
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
