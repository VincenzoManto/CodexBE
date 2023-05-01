import nltk
nltk.download("wordnet", quiet=True)
nltk.download("omw-1.4", quiet=True)

from nltk.corpus import wordnet

import pymssql
import json
import sys
import mysql.connector
import sys


db = sys.argv[1]
if (db == None):
    print('Nessun DB selezionato')
    exit()

mydb = mysql.connector.connect(
  host="localhost",
  user="root",
  password="1234",
  database="codex"
)

mycursor = mydb.cursor(dictionary=True)

mycursor.execute("SELECT * FROM db WHERE id = %s", (db,))

connection = mycursor.fetchone()

mycursor = mydb.cursor(dictionary=True)

mycursor.execute("SELECT * FROM `table` WHERE db = %s", (int(db),))

tables = mycursor.fetchall()

schema = {}
for table in tables:
    if table['description'] != None:
        schema[table['name']] = table['description']

tables = schema
tables

from sentence_transformers import SentenceTransformer
model = SentenceTransformer('multi-qa-mpnet-base-dot-v1')

import pickle
encodes = {}
for table in tables.keys():
  particles = tables[table].split(',')
  i = 0
  for particle in particles:
    encodes[table + '$$' + str(i)] = model.encode(particle.strip())
    i = i + 1

mycursor = mydb.cursor(dictionary=True)

mycursor.execute("SELECT * FROM `schema` WHERE db = %s", (int(db),))

dbschema = mycursor.fetchone()
import os
with open('dictionary/' + str(db) + '.dictionary', 'wb') as config_dictionary_file:
  pickle.dump(encodes, config_dictionary_file)

if connection['type'] == 'mssql':
  conn = pymssql.connect(connection['server'], connection['username'], connection['password'], connection['name'])
  cursor = conn.cursor(as_dict=True)
elif connection['type'] == 'mysql':
  conn = mysql.connector.connect(
    host=connection['server'],
    user=connection['username'],
    password=connection['password'],
    database=connection['name']
  )
  cursor = conn.cursor(dictionary=True)

import pandas as pd
import numpy as np

mycursor.execute("""SELECT concat(t.name, '.', ifnull(c.name, '*')) as name FROM `columns` as c left join `table` as t on c.table = t.id WHERE t.db = %s
                  UNION 
                  SELECT concat(t.name, '.', ifnull(c.name, '*')) as name FROM codex.`columns` as c right join codex.`table` as t on c.table = t.id WHERE t.db = %s""", (int(db), int(db),))

metaColumns = mycursor.fetchall()
if metaColumns is not None:
  metaColumns = list(map(lambda x: x['name'], metaColumns))


import spacy
nlp = spacy.load("en_core_web_md", quiet=True) # download first

descriptionNLP = nlp(u'description, name, code')
  

relevance = {}
for table in tables.keys():
  tableNLP = nlp(table)
  if connection['type'] == 'mysql': 
    cursor.execute("SELECT * FROM " + table + " LIMIT 100")
    data = pd.DataFrame(cursor.fetchall())
  elif connection['type'] == 'mssql':
    cursor.execute("SELECT TOP(100) * FROM " + table)
    data = pd.DataFrame(cursor.fetchall())

  total_length = len(data. index)
  corelation_values = abs(data.corr(numeric_only = True))
  if table not in relevance:
    relevance[table] = {}
  for col in data:
    colNLP = nlp(col.replace('_', ' '))
    if table + '.' + col not in metaColumns:
      continue
    uniques = pd.unique(data[col])
    mean = np.mean(corelation_values[col]) if col in corelation_values else 1
    relevance[table][col] = len(uniques) / total_length / mean / 2 + (tableNLP.similarity(colNLP) + colNLP.similarity(descriptionNLP) / 2)

print(relevance)
with open('dictionary/' + str(db) + '.relevance', 'wb') as config_dictionary_file:
  pickle.dump(relevance, config_dictionary_file)