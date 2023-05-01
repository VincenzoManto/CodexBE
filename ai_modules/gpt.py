import openai

openai.api_key = "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"
gpt_prompt = '''Write a slide's text (single sentence) refering to the topic: best grade\nThe slide's text must be regarding:
{"name": "Piero", "grade": 30, "lesson":"History"}'''

response = openai.ChatCompletion.create(
model="gpt-3.5-turbo",
messages=[{
    "role": "user", "content": gpt_prompt
}],
temperature=0.2,
max_tokens=150,
top_p=1.0,
frequency_penalty=0.0,
presence_penalty=0.0,
stop=["#", ";"]
)
response = response['choices'][0]['message']['content']
print(response)