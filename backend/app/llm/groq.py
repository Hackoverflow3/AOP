import asyncio
import httpx
from app.config import settings

async def groq_complete(messages: list[dict]) -> str:
    for attempt in range(3):
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json={"model": settings.groq_model, "messages": messages},
            )
            if resp.status_code == 429:
                wait = 30 * (attempt + 1)  # 30s, 60s, 90s
                await asyncio.sleep(wait)
                continue
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
    raise RuntimeError("Groq rate limit exceeded after 3 retries")
