# AOP — Autonomous Office Protocol

Four AI specialists. Four rooms. One complete deliverable.

## Stack

| Layer     | Choice                          |
|-----------|---------------------------------|
| Frontend  | Next.js 14 + Tailwind + Three.js |
| Backend   | FastAPI + Python 3.11           |
| Realtime  | Server-Sent Events (SSE)        |
| LLM A/B/D | Ollama `llama3.2:3b` (local)    |
| LLM C     | Groq `llama-3.3-70b-versatile`  |
| Fallback  | Gemini 2.0 Flash                |
| Database  | SQLite (`aop.db`)               |

## Rooms

| Room | Name           | Artifact                  | LLM    |
|------|----------------|---------------------------|--------|
| A    | War Room       | `PROJECT_MANIFEST.md`     | Ollama |
| B    | Ideation Hive  | `BRAINSTORM_LOG.md`       | Ollama |
| C    | The Forge      | `TECHNICAL_SPEC_V1.json`  | Groq   |
| D    | Observatory    | `FINAL_DELIVERY_REPORT.md`| Ollama |

## Run locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- [Ollama](https://ollama.com) running locally

### 1. Pull the model
```bash
ollama pull llama3.2:3b
```

### 2. Backend
```bash
cd backend
cp ../.env.example .env      # fill in GROQ_API_KEY at minimum
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
# → http://localhost:8000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### 4. Open
Visit **http://localhost:3000** — the 3D office will load with agents at the table.

## Project structure

```
aop/
├── frontend/          Next.js app
│   ├── app/           Pages (landing, run, artifacts, dashboard, settings)
│   ├── components/    Shared UI components
│   └── lib/           API client, SSE hook, types, utils
├── backend/           FastAPI app
│   └── app/
│       ├── routers/   HTTP endpoints
│       ├── orchestrator/ Session runner + state machine
│       ├── agents/    Director, Architect, Dev, Catalyst
│       ├── rooms/     A War Room, B Hive, C Forge, D Observatory
│       ├── llm/       Ollama / Groq / Gemini clients + router
│       ├── artifacts/ Storage, zipper, schemas
│       └── db/        SQLite schema + init
├── prompts/           Agent system prompts (markdown)
├── artifacts/         Generated session outputs (gitignored)
└── aop.db             SQLite database (gitignored)
```

## Free tier

All providers used are $0.00:
- Ollama: local inference, no cost
- Groq: free tier (14,400 req/day)
- Gemini 2.0 Flash: free tier (1,500 req/day)
