"""
LLM routing:
  A / B / D → Ollama (local, free, private) → Groq fallback → Gemini fallback
  C         → Groq (70B reasoning)          → Gemini fallback
"""

# Rooms that use local Ollama first
OLLAMA_ROOMS = {"A", "B", "D"}


async def complete(room_id: str, messages: list[dict]) -> str:
    from app.llm.groq import groq_complete
    from app.llm.gemini import gemini_complete
    from app.llm.ollama import ollama_complete

    if room_id in OLLAMA_ROOMS:
        try:
            return await ollama_complete(messages)
        except Exception:
            pass  # Ollama not running — fall through to Groq

    try:
        return await groq_complete(messages)
    except Exception:
        return await gemini_complete(messages)
