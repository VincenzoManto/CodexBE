
import pickle

import pymssql
import json
import sys
import mysql.connector
import sys
import os
from dotenv import load_dotenv
from pathlib import Path

dotenv_path = Path(os.path.abspath(__file__) + '../.env')
load_dotenv()




db = sys.argv[1]
if (db == None):
  raise Exception('No db')


mydb = mysql.connector.connect(
  host=os.getenv("CODEX_DB_HOST"),
  user=os.getenv("CODEX_DB_USER"),
  password=os.getenv("CODEX_DB_PASS"),
  database=os.getenv("CODEX_DB_NAME")
)


prompt = sys.argv[2]
if (len(sys.argv) > 4):
  step = int(sys.argv[4]) if sys.argv[4] is not None else 0 # 0 = pruning, 1 = gpt_prompt, 2 = query, 3 = results
else:
  step = 0
session = sys.argv[3]
if (prompt == None):
  raise Exception('No prompt')


mycursor = mydb.cursor(dictionary=True)


mycursor.execute("SELECT * FROM `table` WHERE db = %s", (int(db),))

tables = mycursor.fetchall()

mycursor.execute("SELECT * FROM `connection` WHERE db = %s", (int(db),))

connection = mycursor.fetchall()

schema = []
edges = {}

for table in tables:
    if table['description'] != None:
        name = table['name']
        local_edges = list(map(lambda x: x['to'], filter(lambda x: x['from'] == name, connection)))
        if name in edges:
            edges[name] = edges[name] + local_edges
        else:
            edges[name] = local_edges
        schema.append(name)


file = open('dictionary/' + str(db) + '.dictionary','rb')
encodes = pickle.load(file)
file.close()

def pruning(prompt, model):
  import re
  import yake
  prompt = prompt.replace('-', ' ')
  kw_extractor = yake.KeywordExtractor(top=10, stopwords=None)
  keywords = kw_extractor.extract_keywords(prompt)
  keywords = list(sorted(keywords, key=lambda x: x[1], reverse=True))

  keywords = list(map(lambda x: x[0], keywords)) 

  sentence = model.encode(prompt.lower())
  keys = model.encode(' '.join(keywords))
  tables = schema
  table_sim = {}


  from scipy.spatial import distance
  import statistics

  sims = []
  encoding = {}
  for table in tables:
    if (table not in encodes):
        print('No training. Please, execute the training using the Designer')
        exit()
    encode = encodes[table]
    encoding[table] = encode
    sim = 1 - distance.cosine(sentence, encode)
    sim2 = 1 - distance.cosine(keys, encode)
    table_sim[table] = (sim + 4 * sim2) / 5
    sims.append(sim)

  avg = statistics.median(sims)
  med = statistics.mean(sims)
  perc = 0.8 * (max(sims))
  #print(avg, med, perc)

  table_sim2 = list(filter(lambda x: x[1] >= perc, table_sim.items()))
  sort = list(sorted(table_sim2, key=lambda x: x[1], reverse=True))
  sort2 = list(map(lambda x: x[0], sort))
  for table in table_sim.keys():
    if table in sort2:
      table_sim[table] = table_sim[table] * 1.1

  import copy
  import math

  tables_weights_prev = copy.copy(table_sim)

  def update(table, lvl):
    fks = len(list(edges[table]))
    for fk in list(edges[table]):
        tables_weights[fk] += tables_weights[table] * math.pow(0.08, lvl)
        tables_weights[table] += tables_weights[fk] * math.pow(0.08, lvl)
        if fk in edges:
          update(fk, lvl + 1)

  tables_weights = copy.copy(table_sim)
  for table in table_sim.keys():
    if table in edges:
      update(table, 1)

  #print(tables_weights)
  perc = pow(max(tables_weights.values()), 1.5)
  #print(perc)
  table_sim2 = list(filter(lambda x: x[1] >= perc, tables_weights.items()))
  items = list(tables_weights.items())
  sort = list(sorted(table_sim2, key=lambda x: x[1], reverse=True))
  picked_table_names = list(map(lambda x: x[0], sort))
  table_sim3 = {}
  for i in range(0, len(items)):
    row = items[i]
    table_sim3[row[0]] = row[1]
  return [table_sim3, [picked_table_names, tables_weights]]

  return [picked_table_names, tables_weights]

from sentence_transformers import SentenceTransformer
model = SentenceTransformer('multi-qa-mpnet-base-dot-v1')

[pruningResults, [picked_tables, tables_weights]] = pruning(prompt, model)

finalResult = {}
finalResult['pruning'] = pruningResults

finalResult['jumps'] = []

mycursor.execute("SELECT * FROM `db` WHERE id = %s", (int(db),))

connection = mycursor.fetchone()
if (connection['type'] == 'mssql' and step > 0):

  table_names = [("'" + i + "'") for i in picked_tables]

  conn = pymssql.connect(connection['server'], connection['username'], connection['password'], connection['name'])
  cursor = conn.cursor(as_dict=True)

  cursor.execute("""SELECT distinct	column_name, table_name, data_type, A.REF as ref_table, A.REFCOLNAME as ref_column FROM
  INFORMATION_SCHEMA.COLUMNS
  left join (SELECT
  OBJECT_NAME(parent_object_id) PARENT,
  c.NAME COLNAME,
  OBJECT_NAME(referenced_object_id) REF,
  cref.NAME REFCOLNAME
  FROM
  sys.foreign_key_columns fkc
  INNER JOIN
  sys.columns c
    ON fkc.parent_column_id = c.column_id
        AND fkc.parent_object_id = c.object_id
  INNER JOIN
  sys.columns cref
    ON fkc.referenced_column_id = cref.column_id
        AND fkc.referenced_object_id = cref.object_id ) A on PARENT = table_name and COLNAME = column_name
      where 
      table_name in (""" + ','.join(table_names) + """)
      order by TABLE_NAMe
  """)

  mycursor = mydb.cursor(dictionary=True)

  mycursor.execute("SELECT * FROM `table` WHERE db = %s", (int(db),))

  tables = mycursor.fetchall()

  whereClause = ','.join(list(map(lambda x: str(x['id']), tables)))
  mycursor.execute("""SELECT concat(t.name, '.', ifnull(c.name, '*')) as name FROM `columns` as c left join `table` as t on c.table = t.id WHERE t.id in (""" + whereClause + """) 
                   UNION 
                   SELECT concat(t.name, '.', ifnull(c.name, '*')) as name FROM codex.`columns` as c right join codex.`table` as t on c.table = t.id WHERE t.id in (""" + whereClause + """)""")

  metaColumns = mycursor.fetchall()
  if metaColumns is not None:
    metaColumns = list(map(lambda x: x['name'], metaColumns))

  tagged_table_names = list(map(lambda x: x['name'], tables))

  fks = {}

  cols = {}
  for row in cursor:
    if (row['table_name'] not in cols):
      cols[row['table_name']] = ''
    newCol = row['column_name']
    if (row['ref_table'] is not None and row['ref_table'] in tagged_table_names):
      if (row['table_name'] not in fks):
        fks[row['table_name']] = []
      fk = {}
      fk['from'] = row['column_name']
      filtered = list(filter(lambda x: x['name'] == row['ref_table'], tables))
      fk['to'] = row['ref_column']
      fk['to_table'] = row['ref_table']
      fk['to_table_alias'] = filtered[0]['description']
      fks[row['table_name']].append(fk)
    completeName = row['table_name'] + '.' + row['column_name']
    if completeName in metaColumns or row['table_name'] + '.*' in metaColumns:
     cols[row['table_name']] = cols[row['table_name']] + row['column_name'] + '|'

  schema = ''
  for table in cols:
    filtered = list(filter(lambda x: x['name'] == table, tables))
    description = ''
    if (len(filtered) > 0):
      description = filtered[0]['description']
    schema = schema + table + ' (' + description + ')' + ':' + cols[table] + '\n'
  gpt_prompt = 'SQL Server tables (use LIKE):\n' + schema + '#' + prompt + '\nSELECT'

  finalResult['gpt_prompt'] = gpt_prompt

  if (step > 1):

    import openai

    openai.api_key = "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"

    response = openai.Completion.create(
      model="gpt-3.5-turbo",
      prompt=gpt_prompt,
      temperature=0,
      max_tokens=150,
      top_p=1.0,
      frequency_penalty=0.0,
      presence_penalty=0.0,
      stop=["#", ";"]
    )

    query = ("SELECT " + response['choices'][0]['text']).replace('\\n','').replace('\\r','')

    query = "select * from ordinedettc where datains >= '2023-01-01'"
    finalResult['query'] = query

    if (step > 2):
      try:
        finalResult['results'] = []
        cursor.execute(query)
        extractedCols = []
        for row in cursor:
          for col in row.keys():
            if not row[col] == None and (not (type(row[col]) == int or type(row[col]) == float)):
               row[col] = str(row[col])
          finalResult['results'].append(row)
        if (len(finalResult['results']) > 0):
          extractedCols = finalResult['results'][0].keys()
        finalResult['jumps'] = []
        for table in fks.keys():
          finalResult['jumps'] = finalResult['jumps'] + list(filter(lambda x: x['from'] in extractedCols, fks[table]))
      except:
        finalResult['results'] = []


jumpableTables = set(map(lambda x: x['to_table'], finalResult['jumps']))
newFks = []
for jump in jumpableTables:
  fks = list(filter(lambda x: x['to_table'] in jump, finalResult['jumps']))
  fk = {}
  fk['to_table'] = jump
  fk['from'] = fks[0]['from']
  fk['to'] = fks[0]['to']
  for nfk in fks:
      if (nfk['from'] not in fk['from']):
        fk['from'] = fk['from'] + '|' + nfk['from']
        fk['to'] = fk['to'] + '|' + nfk['to']
  fk['to_table_alias'] = fks[0]['to_table_alias']
  newFks.append(fk)
finalResult['jumps'] = newFks
if 'results' in finalResult:
  value = json.dumps(finalResult['results'])
  with open('temp/' + session, 'w') as f:
      f.write(value)
print(json.dumps(finalResult))
sys.stdout.flush()
