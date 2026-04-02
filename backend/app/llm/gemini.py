import httpx
from app.config import settings

async def gemini_complete(messages: list[dict]) -> str:
    # Flatten messages to a single prompt for Gemini
    prompt = "\n".join(f"{m['role']}: {m['content']}" for m in messages)
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={settings.gemini_api_key}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
        )
        resp.raise_for_status()
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
