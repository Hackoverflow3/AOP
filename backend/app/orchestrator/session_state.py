from dataclasses import dataclass, field
from typing import Optional

ROOM_ORDER = ["A", "B", "C", "D"]

@dataclass
class SessionState:
    session_id: str
    task: str
    current_room: Optional[str] = None
    completed_rooms: list[str] = field(default_factory=list)
    artifacts: dict[str, str] = field(default_factory=dict)   # room_id → file_path
    status: str = "pending"   # pending | running | done | failed
