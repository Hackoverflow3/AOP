"""
LLM routing:
  All rooms → Groq (llama-3.3-70b-versatile)
  Fallback  → Gemini (gemini-2.0-flash)
"""
from app.config import settings

ROOM_TO_PROVIDER = {
    "A": "groq",
    "B": "groq",
    "C": "groq",
    "D": "groq",
}


async def complete(room_id: str, messages: list[dict]) -> str:
    provider = ROOM_TO_PROVIDER.get(room_id, "groq")
    try:
        from app.llm.groq import groq_complete
        return await groq_complete(messages)
    except Exception:
        from app.llm.gemini import gemini_complete
        return await gemini_complete(messages)
