from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from app.db.init import get_conn
import app.db.queries as queries
from app.artifacts import zipper

router = APIRouter()


@router.get("/{session_id}")
def list_artifacts(session_id: str):
    conn = get_conn()
    try:
        return queries.get_artifacts(conn, session_id)
    finally:
        conn.close()


@router.get("/{session_id}/download/{filename}")
def download_artifact(session_id: str, filename: str):
    conn = get_conn()
    try:
        artifacts = queries.get_artifacts(conn, session_id)
    finally:
        conn.close()

    # Look up file_path from DB by session_id + filename — never use filename directly
    # in os.path.join to prevent path traversal attacks.
    record = next(
        (a for a in artifacts if a["filename"] == filename),
        None,
    )
    if record is None:
        raise HTTPException(status_code=404, detail="Artifact not found")

    return FileResponse(
        path=record["file_path"],
        filename=record["filename"],
        media_type="application/octet-stream",
    )


@router.get("/{session_id}/zip")
def download_zip(session_id: str):
    zip_path = zipper.zip_session(session_id)
    return FileResponse(
        path=zip_path,
        filename=f"{session_id}.zip",
        media_type="application/zip",
    )
