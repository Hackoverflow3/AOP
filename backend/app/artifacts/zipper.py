import zipfile, os
from app.config import settings

def zip_session(session_id: str) -> str:
    dir_path = os.path.join(settings.artifacts_dir, session_id)
    zip_path = os.path.join(dir_path, "session.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fname in os.listdir(dir_path):
            if fname != "session.zip":
                zf.write(os.path.join(dir_path, fname), fname)
    return zip_path
