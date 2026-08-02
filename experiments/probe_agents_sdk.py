"""Probe: openai-agents SDK against Kimi K3 (moonshot OpenAI-compatible endpoint)."""
import os
import asyncio
from dotenv import load_dotenv
from openai import AsyncOpenAI
from agents import Agent, Runner, OpenAIChatCompletionsModel, set_tracing_disabled

load_dotenv('.env')
set_tracing_disabled(True)

client = AsyncOpenAI(
    base_url='https://api.moonshot.ai/v1',
    api_key=os.environ['KIMI_KEY_ONTOLOGY'],
)
model = OpenAIChatCompletionsModel(model='kimi-k3', openai_client=client)


async def main():
    agent = Agent(name='probe', instructions='Reply with just: ok', model=model)
    r = await Runner.run(starting_agent=agent, input='hello')
    print('output:', r.final_output)
    for resp in r.raw_responses:
        print('usage:', resp.usage)


asyncio.run(main())
