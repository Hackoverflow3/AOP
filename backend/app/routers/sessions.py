import uuid
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.db.init import get_conn
import app.db.queries as queries

router = APIRouter()


class SessionCreate(BaseModel):
    title: str
    task: str


@router.get("")
@router.get("/")
def list_sessions():
    conn = get_conn()
    try:
        return queries.list_sessions(conn)
    finally:
        conn.close()


@router.post("", status_code=201)
@router.post("/", status_code=201)
def create_session(body: SessionCreate):
    session_id = str(uuid.uuid4())
    conn = get_conn()
    try:
        queries.create_session(conn, session_id, body.title, body.task)
        session = queries.get_session(conn, session_id)
    finally:
        conn.close()
    return session


@router.get("/{session_id}")
def get_session(session_id: str):
    conn = get_conn()
    try:
        session = queries.get_session(conn, session_id)
    finally:
        conn.close()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
