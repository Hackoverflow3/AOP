from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import sessions, runner, artifacts
from app.db.init import init_db

app = FastAPI(title="AOP — Autonomous Office Protocol", version="0.1.0", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router,  prefix="/sessions",  tags=["sessions"])
app.include_router(runner.router,    prefix="/run",       tags=["runner"])
app.include_router(artifacts.router, prefix="/artifacts", tags=["artifacts"])


@app.on_event("startup")
async def startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}
