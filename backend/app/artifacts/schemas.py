from pydantic import BaseModel

class ArtifactOut(BaseModel):
    id: str
    session_id: str
    room_id: str
    filename: str
    file_path: str
    created_at: str
