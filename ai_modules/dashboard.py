#python3
from rasa.core.agent import Agent
import asyncio
import json
import os
import sys

model_path = os.path.dirname(__file__) + "\dashboard\\rasaModel.tar.gz"
agent = Agent.load(model_path)
print('Waiting...')

while True:
    try:
        message = input().strip()
    except (EOFError, KeyboardInterrupt):
        break

    result = asyncio.run(agent.parse_message(message))
    print(json.dumps(result, indent=2))
    