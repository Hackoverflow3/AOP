from abc import ABC, abstractmethod


class BaseAgent(ABC):
    name: str
    role: str

    @abstractmethod
    async def respond(self, context: str, history: list[dict]) -> str:
        """Generate a response given context and message history."""
        ...
