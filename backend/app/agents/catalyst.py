from pathlib import Path

from app.agents.base import BaseAgent
from app.llm import client as llm_client

_PROMPT_PATH = Path(__file__).parent.parent.parent.parent / "prompts" / "catalyst.md"


class CatalystAgent(BaseAgent):
    name = "Catalyst"
    role = "Red-teamer — challenges assumptions, surfaces edge cases, stress-tests decisions"
    room_id = "B"

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
