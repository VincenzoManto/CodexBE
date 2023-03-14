import openai

openai.api_key = "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"

response = openai.ChatCompletion.create(
    model="gpt-3.5-turbo",
    messages=[
    {"role": "user", "content":
"""Write me ONLY THE CODE OF the query for: what is the best sold product of 2023?
SQL Server schema (use LIKE):
sales, sales order rows, sales products [table ordineDettc]: Cd_Artico, Cd_Colle, Cd_Colore, Cd_Lavagg, Cd_Linea, Cd_Modello, Cd_Stagion, NOrdine, NRiga, Totalecapi
sales, sales order headers  [table ordineTes]: Nordine, Data"""}
  ]
)

print(response)