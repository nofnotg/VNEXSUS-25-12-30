#!/usr/bin/env python3
"""Quick SSL bypass test for GPT"""
import os
import asyncio
import httpx
from openai import AsyncOpenAI

async def test_gpt():
    api_key = os.environ.get('OPENAI_API_KEY', '')
    if not api_key:
        print("No API key")
        return

    try:
        # SSL verification bypass
        http_client = httpx.AsyncClient(verify=False, timeout=60.0)
        client = AsyncOpenAI(api_key=api_key, http_client=http_client)

        print("Testing GPT-4o-mini with SSL bypass...")
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "user", "content": "Say hello in Korean"}
            ],
            max_tokens=50
        )

        print(f"✅ Success: {response.choices[0].message.content}")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_gpt())
