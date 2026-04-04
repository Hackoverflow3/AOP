import asyncio
import httpx
from app.config import settings

async def gemini_complete(messages: list[dict]) -> str:
    # Flatten messages to a single prompt for Gemini
    prompt = "\n".join(f"{m['role']}: {m['content']}" for m in messages)
    for attempt in range(3):
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={settings.gemini_api_key}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
            if resp.status_code == 429:
                wait = 30 * (attempt + 1)  # 30s, 60s, 90s
                await asyncio.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
    raise RuntimeError("Gemini rate limit exceeded after 3 retries")
