import asyncio
import sqlite3
from abc import ABC, abstractmethod


class BaseRoom(ABC):
    room_id: str          # A | B | C | D
    name: str
    artifact_filename: str

    def __init__(
        self,
        db_conn: sqlite3.Connection,
        event_queue: asyncio.Queue,
    ) -> None:
        self.db_conn = db_conn
        self.event_queue = event_queue

    @abstractmethod
    async def run(self, session_id: str, task: str, prior_context: str = "") -> str:
        """Run the room and return the artifact content string."""
        ...
