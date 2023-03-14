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

'''
for table in schema.keys():
  synonyms = [] 
  for syn in wordnet.synsets(schema[table]):
    for lm in syn.lemmas():
      synonyms.append(lm.name())
  schema[table] += ',' +  ', '.join(dict.fromkeys(synonyms)).replace('_',' ')
''' 

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

'''
def convertToBinaryData(filename):
    with open(filename, 'rb') as file:
        binaryData = file.read()
    return binaryData

file = convertToBinaryData('config.dictionary')

if (dbschema != None):
    mycursor.execute("UPDATE `schema` SET encode = %s WHERE db = %s", (file, int(db)))
else:
    mycursor.execute("INSERT INTO `schema` (db, encode) VALUES (%s,%s)", (int(db), file))
mydb.commit()
os.remove('config.dictionary')
'''