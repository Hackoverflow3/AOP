import os, aiofiles
from app.config import settings

async def save_artifact(session_id: str, filename: str, content: str) -> str:
    dir_path = os.path.join(settings.artifacts_dir, session_id)
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, filename)
    async with aiofiles.open(file_path, "w") as f:
        await f.write(content)
    return file_path
