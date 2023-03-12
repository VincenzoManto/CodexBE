from difflib import SequenceMatcher

def similar(a, b):
    return SequenceMatcher(None, a, b).ratio()


import sys
import re
import mysql.connector

mydb = mysql.connector.connect(
  host="localhost",
  user="root",
  password="Nfcncp0p",
  database="insighterMeta"
)

mycursor = mydb.cursor()

mycursor.execute("SELECT text, query FROM inquiries")

myresult = mycursor.fetchall()

inp = re.sub(r'\'|_| i | il | l\'| le | un | uno | gli | lo | una | la |qual è|dammi ', ' ', sys.argv[1].lower()).strip()
sentences = [inp]

for sentence in myresult:
    text = re.sub(r'\'|_| i | il | l\'| le | un | uno | gli | lo | una | la |qual è|dammi ', ' ', sentence[0].lower()).strip()
    sentences.append(text)
    p = similar(text, inp)
    if (p > 0.85):
        print(sentence[1])


from sentence_transformers import SentenceTransformer
model = SentenceTransformer('dbmdz/bert-base-italian-cased')

sentence_embeddings = model.encode(sentences)

import torch.nn
cos = torch.nn.CosineSimilarity(dim=0, eps=1e-6)
b = torch.from_numpy(sentence_embeddings)
print(cos(b[0], b[1]).item())
print(cos(b[0], b[2]).item())
