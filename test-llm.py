"""
LLM API Key Tester
------------------
Tests Groq and Gemini API keys with a simple prompt.

Usage:
    python test-llm.py

Fill in your API keys below before running.
"""

import asyncio

import httpx

# ── Put your API keys here ─────────────────────────────────────────────────────
GROQ_API_KEY = "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"
GEMINI_API_KEY = "AIzaSyBMclVx5wTb1TwJh7ZPtkqxHEjEucLcTY8"

GROQ_MODEL = "llama-3.3-70b-versatile"
GEMINI_MODEL = "gemini-2.0-flash"

TEST_MESSAGES = [{"role": "user", "content": "Reply with exactly: API key works!"}]
# ───────────────────────────────────────────────────────────────────────────────


async def test_groq():
    print("\n🔍 Testing Groq...")
    if GROQ_API_KEY == "your_groq_api_key_here":
        print("  ⚠️  Skipped — GROQ_API_KEY not set")
        return

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                json={"model": GROQ_MODEL, "messages": TEST_MESSAGES},
            )
            resp.raise_for_status()
            reply = resp.json()["choices"][0]["message"]["content"]
            print(f"  ✅ Groq OK — model: {GROQ_MODEL}")
            print(f"     Response: {reply.strip()}")
    except httpx.HTTPStatusError as e:
        print(f"  ❌ Groq FAILED — HTTP {e.response.status_code}: {e.response.text}")
    except Exception as e:
        print(f"  ❌ Groq FAILED — {e}")


async def test_gemini():
    print("\n🔍 Testing Gemini...")
    if GEMINI_API_KEY == "your_gemini_api_key_here":
        print("  ⚠️  Skipped — GEMINI_API_KEY not set")
        return

    prompt = "\n".join(f"{m['role']}: {m['content']}" for m in TEST_MESSAGES)
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
            )
            resp.raise_for_status()
            reply = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            print(f"  ✅ Gemini OK — model: {GEMINI_MODEL}")
            print(f"     Response: {reply.strip()}")
    except httpx.HTTPStatusError as e:
        print(f"  ❌ Gemini FAILED — HTTP {e.response.status_code}: {e.response.text}")
    except Exception as e:
        print(f"  ❌ Gemini FAILED — {e}")


async def main():
    print("=" * 50)
    print("  AOP — LLM API Key Tester")
    print("=" * 50)
    await test_groq()
    await test_gemini()
    print()


if __name__ == "__main__":
    asyncio.run(main())
