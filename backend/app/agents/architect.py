from pathlib import Path

from app.agents.base import BaseAgent
from app.llm import client as llm_client

_PROMPT_PATH = Path(__file__).parent.parent.parent.parent / "prompts" / "architect.md"


class ArchitectAgent(BaseAgent):
    name = "Architect"
    role = "System designer — produces state machines, diagrams, and the technical spec"
    room_id = "C"

    def __init__(self) -> None:
        self.system_prompt: str = _PROMPT_PATH.read_text(encoding="utf-8")

    async def respond(
        self,
        context: str,
        history: list[dict],
        room_id: str = None,
    ) -> str:
        effective_room = room_id if room_id is not None else self.room_id
        messages = [
            {"role": "system", "content": self.system_prompt},
            *history,
            {"role": "user", "content": context},
        ]
        return await llm_client.complete(effective_room, messages)
