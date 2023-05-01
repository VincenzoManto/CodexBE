
import pickle
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3' 

import pymssql
import json
import numpy as np
import sys
import mysql.connector
import sys
from dotenv import load_dotenv
import random
from pathlib import Path
from sentence_transformers import SentenceTransformer

dotenv_path = Path(os.path.abspath(__file__) + '../.env')
load_dotenv()

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
  #encoding = {}
  encodedTables = encodes.keys()

  for table in tables:

    iEncoding = list(filter(lambda x: table + '$$' in x, encodedTables))
    if (len(iEncoding) <= 0):
      print('No training. Please, execute the training using the Designer')
      exit()
    maximumLH = 0
    for encodedTable in iEncoding:
      encode = encodes[encodedTable]
      #encoding[table] = encode
      sim = 1 - distance.cosine(sentence, encode)
      sim2 = 1 - distance.cosine(keys, encode)
      lh = (sim + 4 * sim2) / 5
      if lh > maximumLH:
        maximumLH = lh
    table_sim[table] = maximumLH
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
        tables_weights[fk] += tables_weights[table] * math.pow(0.07, lvl)
        tables_weights[table] += tables_weights[fk] * math.pow(0.07, lvl)
        if fk in edges:
          update(fk, lvl + 1)

  tables_weights = copy.copy(table_sim)
  for table in table_sim.keys():
    if table in edges:
      update(table, 1)

  #print(tables_weights)
  perc = 0.75 * max(tables_weights.values())
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


def createPromptGPT(cursor):
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

  rows = cursor.fetchall()
  cols = {}
  for row in rows:
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

  schema = ''
  for table in cols:
    filtered = list(filter(lambda x: x['name'] == table, tables))
    description = ''
    if (len(filtered) > 0):
      description = filtered[0]['description']
    schema = schema + table + ' (' + description + ')' + ':' + cols[table] + '\n'

  numericCols = list(filter(lambda x: x['data_type'] in ['int', 'float', 'double', 'decimal'] and x['ref_column'] is None, list(rows)))
  fksCols = list(filter(lambda x: x['ref_table'] in picked_tables and x['ref_column'] is not None, list(rows)))

  visibleCols = []
  cols = {}

  for table in picked_tables:
    mean = 0.5 * np.max(list(map(lambda y: y[1], filter(lambda x: 'id' not in x[0], relevance[table].items()))))
    cols[table] = list(map(lambda y: y[0], relevance[table].items()))
    visibleCols = visibleCols + list(filter(lambda x: x['column_name'] in cols[table] and x['data_type'] == 'varchar', list(rows)))

  queries = []
  templates = [
    "SELECT <t1>.<v1>, <t1>.<v2>, <t1>.<v3> FROM <t1>",
    "SELECT <t1>.<v1>, <t1>.<v2> FROM <t1>",
    "SELECT <t1>.<v1>, <t1>.<i1> FROM <t1>",
    "SELECT COUNT(<t1>.<v1>) as 'Nr <t1v1>' FROM <t1>",
    "SELECT MAX(<t1>.<i1>) as 'Maximum <t1i1>', MIN(<t1>.<i1>) as 'Minium <t1i1>', AVG(<t1>.<i1>) as 'Average <t1i1>' FROM <t1>",
    "SELECT MAX(<t1>.<i1>) as 'Maximum <t1i1> per <t1v1>', MIN(<t1>.<i1>) as 'Minimum <t1i1> per <t1v1>', AVG(<t1>.<i1>) as 'Average <t1i1> per <t1v1>', <t1>.<v1> FROM <t1> GROUP BY <t1>.<v1>",
    "SELECT * FROM (SELECT COUNT(<t1>.<i1>) as 'Nr of <t1i1>', MAX(<t1>.<i1>) as 'Maximum <t1i1> per <t1v1>', MIN(<t1>.<i1>) as 'Minimum <t1i1> per <t1v1>', AVG(<t1>.<i1>) as 'Average <t1i1> per <t1v1>', <t1>.<v1> FROM <t1> GROUP BY <t1>.<v1>) AS X ORDER BY X.`Nr of <t1i1>`, X.`Maximum <t1i1> per <t1v1>` DESC LIMIT 1",
    "SELECT top(1) * FROM (SELECT COUNT(<t1>.<i1>) as 'Nr of <t1i1>', MAX(<t1>.<i1>) as 'Maximum <t1i1> per <t1v1>', MIN(<t1>.<i1>) as 'Minimum <t1i1> per <t1v1>', AVG(<t1>.<i1>) as 'Average <t1i1> per <t1v1>', <t1>.<v1> FROM <t1> GROUP BY <t1>.<v1>) AS X ORDER BY X.`Nr of <t1i1>`, X.`Maximum <t1i1> per <t1v1>` DESC",
    "SELECT * FROM (SELECT COUNT(<t1>.<i1>) as 'Nr of <t1i1>', MAX(<t1>.<i1>) as 'Maximum <t1i1> per <t1v1>', MIN(<t1>.<i1>) as 'Minimum <t1i1> per <t1v1>', AVG(<t1>.<i1>) as 'Average <t1i1> per <t1v1>', <t1>.<v1> FROM <t1> GROUP BY <t1>.<v1>) AS X ORDER BY X.`Nr of <t1i1>`, X.`Minimum <t1i1> per <t1v1>` ASC LIMIT 1",
    "SELECT top(1) * FROM (SELECT COUNT(<t1>.<i1>) as 'Nr of <t1i1>', MAX(<t1>.<i1>) as 'Maximum <t1i1> per <t1v1>', MIN(<t1>.<i1>) as 'Minimum <t1i1> per <t1v1>', AVG(<t1>.<i1>) as 'Average <t1i1> per <t1v1>', <t1>.<v1> FROM <t1> GROUP BY <t1>.<v1>) AS X ORDER BY X.`Nr of <t1i1>`, X.`Minimum <t1i1> per <t1v1>` ASC",
    "SELECT COUNT(<t1>.<i1>) as 'Nr <t1i1> per <t1v1>', <t1v1> FROM <t1>.<t1> GROUP BY <t1>.<v1>",
    "SELECT COUNT(<t1>.<i1>) as 'Nr <t1i1> per <t1v1> and <t1v2>', <t1>.<v1>, <t1>.<v2> FROM <t1>.<t1> GROUP BY <t1>.<v1>, <t1>.<v2>",
    "SELECT <t1>.<v1>, <t2>.<v1> FROM <t1> INNER JOIN <t2> ON <join>",
    "SELECT MAX(<t1>.<i1>) as 'Maximum <t1i1> per <t2v1>', MIN(<t1>.<i1>) as 'Minimum <t1i1> per <t2v1>', AVG(<t1>.<i1>) as 'Average <t1i1> per <t2v1>', <t2>.<v1> FROM <t1> INNER JOIN <t2> ON <join> GROUP BY <t2>.<v1>",
    "SELECT * FROM (SELECT COUNT(<t1>.<i1>) as 'Nr of <t1i1>', MAX(<t1>.<i1>) as 'Maximum <t1i1> per <t2v1>', MIN(<t1>.<i1>) as 'Minimum <t1i1> per <t2v1>', AVG(<t1>.<i1>) as 'Average <t1i1> per <t2v1>', <t2>.<v1> FROM <t1> INNER JOIN <t2> ON <join> GROUP BY <t2>.<v1>) AS X ORDER BY X.`Nr of <t1i1>`, X.`Maximum <t1i1> per <t2v1>` DESC LIMIT 1",
    "SELECT * FROM (SELECT COUNT(<t1>.<i1>) as 'Nr of <t1i1>', MAX(<t1>.<i1>) as 'Maximum <t1i1> per <t2v1>', MIN(<t1>.<i1>) as 'Minimum <t1i1> per <t2v1>', AVG(<t1>.<i1>) as 'Average <t1i1> per <t2v1>', <t2>.<v1> FROM <t1> INNER JOIN <t2> ON <join> GROUP BY <t2>.<v1>) AS X ORDER BY X.`Nr of <t1i1>`, X.`Minimum <t1i1> per <t2v1>` ASC LIMIT 1",
    "SELECT top(1) * FROM (SELECT COUNT(<t1>.<i1>) as 'Nr of <t1i1>', MAX(<t1>.<i1>) as 'Maximum <t1i1> per <t2v1>', MIN(<t1>.<i1>) as 'Minimum <t1i1> per <t2v1>', AVG(<t1>.<i1>) as 'Average <t1i1> per <t2v1>', <t2>.<v1> FROM <t1> INNER JOIN <t2> ON <join> GROUP BY <t2>.<v1>) AS X ORDER BY X.`Nr of <t1i1>`, X.`Maximum <t1i1> per <t2v1>` DESC",
    "SELECT top(1) * FROM (SELECT COUNT(<t1>.<i1>) as 'Nr of <t1i1>', MAX(<t1>.<i1>) as 'Maximum <t1i1> per <t2v1>', MIN(<t1>.<i1>) as 'Minimum <t1i1> per <t2v1>', AVG(<t1>.<i1>) as 'Average <t1i1> per <t2v1>', <t2>.<v1> FROM <t1> INNER JOIN <t2> ON <join> GROUP BY <t2>.<v1>) AS X ORDER BY X.`Nr of <t1i1>`, X.`Minimum <t1i1> per <t2v1>` ASC",
    "SELECT COUNT(<t1>.<i1>) as 'Nr <t1i1> per <t2v1>', <t2>.<v1> FROM <t1> INNER JOIN <t2> ON <join> GROUP BY <t2>.<v1>",
    "SELECT MAX(<t1>.<i1>) as 'Maximum <t1i1> per <t2i2>', MIN(<t1>.<i1>) as 'Minimum <t1>.<i1> per <t2i2>', AVG(<t1>.<i1>) as 'Average <t1i1> per <t2i2>', <t2>.<i2> FROM <t1> INNER JOIN <t2> ON <join> GROUP BY <t2>.<i2>",
    "SELECT COUNT(<t1>.<i1>) as 'Nr <t1>.<i1> per <t2i2>', <t2>.<i2> FROM <t1> INNER JOIN <t2> ON <join> GROUP BY <t2>.<i2>",
    "SELECT MAX(<t1>.<i1>) as 'Maximum <t1i1> per <t2fk1>', MIN(<t1>.<i1>) as 'Minimum <t1i1> per <t2fk1>', AVG(<t1>.<i1>) as 'Average <t1i1> per <t2fk1>', <t2>.<fk1> FROM <t1> INNER JOIN <t2> ON <join> GROUP BY <t2>.<fk1>",
    "SELECT COUNT(<t1>.<i1>) as 'Nr <t1i1> per <t2fk1>', <t2>.<fk1> FROM <t1> INNER JOIN <t2> ON <join> GROUP BY <t2>.<fk1>",
    "SELECT SUM(<t1>.<i1>) as 'Total <t1i1> per <t2fk1>', <t2>.<fk1> FROM <t1> INNER JOIN <t2> ON <join> GROUP BY <t2>.<fk1>",
    "SELECT SUM(<t1>.<i1>) as 'Total <t1i1>' FROM <t1>",
    "SELECT SUM(<t1>.<i1>) as 'Total <t1i1> per <t1v1>', <t1>.<v1> FROM <t1> GROUP BY <t1>.<v1>",
  ]
  counts = {}
  for template in templates:
    counts[template] = 2
  i = 0
  while len(queries) < 6 and (i < 1000 and len(templates) > 0):
    template = random.choice(templates)
    t1 = random.choice(picked_tables)
    numericColsT1 = list(map(lambda y: y['column_name'], list(filter(lambda x: 'id' not in x['column_name'] and x['table_name'] == t1 and x['column_name'] in cols[t1], numericCols))))
    random.shuffle(numericColsT1)
    t1i1 = numericColsT1[0] if len(numericColsT1) > 0 else ''
    t1i2 = numericColsT1[1] if len(numericColsT1) > 1 else ''
    t1i3 = numericColsT1[2] if len(numericColsT1) > 2 else ''
    visibleColsT1 = list(map(lambda y: y['column_name'], list(filter(lambda x: x['table_name'] == t1 and x['column_name'] in cols[t1], visibleCols))))
    random.shuffle(visibleColsT1)
    t1v1 = visibleColsT1[0] if len(visibleColsT1) > 0 else ''
    t1v2 = visibleColsT1[1] if len(visibleColsT1) > 1 else ''
    t1v3 = visibleColsT1[2] if len(visibleColsT1) > 2 else ''
    query = template
    query = query.replace('<t1>.<v1>', t1 + '.' + t1v1)
    query = query.replace('<t1v1>', t1v1)
    query = query.replace('<t1>.<v2>', t1 + '.' + t1v2)
    query = query.replace('<t1v2>', t1v2)
    query = query.replace('<t1>.<v3>', t1 + '.' + t1v3)
    query = query.replace('<t1v3>', t1v3)
    query = query.replace('<t1>.<i1>', t1 + '.' + t1i1)
    query = query.replace('<t1i1>', t1i1)
    query = query.replace('<t1>.<i2>', t1 + '.' + t1i2)
    query = query.replace('<t1i2>', t1i2)
    query = query.replace('<t1>.<i3>', t1 + '.' + t1i3)
    query = query.replace('<t1i3>', t1i3)
    query = query.replace('<t1>', t1)
    if '<t2>' in template:
      if len(picked_tables) <= 1:
        continue
      t2 = random.choice(picked_tables) # list(set(picked_tables) - set(t1))[0]
      fksColsT1T2 = list(filter(lambda x: (x['ref_table'], x['table_name']) in [(t1,t2),(t2,t1)], fksCols))
      if len(fksColsT1T2) <= 0:
        continue
      else:
        join = ' and '.join(list(map(lambda x: x['table_name'] + '.' + x['column_name'] + ' = ' + x['ref_table'] + '.' + x['ref_column'], fksColsT1T2)))
      numericColsT2 = list(map(lambda y: y['column_name'], filter(lambda x: 'id' not in x['column_name'] and x['table_name'] == t2 and x['column_name'] in cols[t2], numericCols)))
      random.shuffle(numericColsT2)
      t2i1 = numericColsT2[0] if len(numericColsT2) > 0 else ''
      t2i2 = numericColsT2[1] if len(numericColsT2) > 1 else ''
      t2i3 = numericColsT2[2] if len(numericColsT2) > 2 else ''
      visibleColsT2 = list(map(lambda y: y['column_name'], filter(lambda x: x['table_name'] == t2 and x['column_name'] in cols[t2], visibleCols)))
      random.shuffle(visibleColsT2)
      t2v1 = visibleColsT2[0] if len(visibleColsT2) > 0 else ''
      t2v2 = visibleColsT2[1] if len(visibleColsT2) > 1 else ''
      t2v3 = visibleColsT2[2] if len(visibleColsT2) > 2 else ''
      
      query = query.replace('<t2>.<v1>', t2 + '.' + t2v1)
      query = query.replace('<t2v1>', t2v1)
      query = query.replace('<t2>.<v2>', t2 + '.' + t2v2)
      query = query.replace('<t2v2>', t2v2)
      query = query.replace('<t2>.<v3>', t2 + '.' + t2v3)
      query = query.replace('<t2v3>', t2v3)
      query = query.replace('<t2>.<i1>', t2 + '.' + t2i1)
      query = query.replace('<t2i1>', t2i1)
      query = query.replace('<t2>.<i2>', t2 + '.' + t2i2)
      query = query.replace('<t2i2>', t2i2)
      query = query.replace('<t2>.<i3>', t2 + '.' + t2i3)
      query = query.replace('<t2i3>', t2i3)
      query = query.replace('<t2>.<fk1>', t2 + '.' + fksColsT1T2[0]['column_name'])
      query = query.replace('<t2fk1>', fksColsT1T2[0]['column_name'])

      query = query.replace('<join>', join)
      query = query.replace('<t2>', t2)
    i = i + 1
    try:
      if (query in queries):
        continue
      cursor.execute(query)
      x = cursor.fetchmany(10)
      queries.append(query)
      counts[template] = counts[template] - 1
      if counts[template] < 0:
        templates.remove(template)
    except Exception as e:
      continue
  
  if len(queries) < 6:
    from pruningservice import ultimate
    import time
    final = ultimate(mydb, db, "i want statistics about " + needle, time.time())
    if len(final['results']) > 0:
      queries.append(final['query']) 
    
  return queries

def createPromptGPTSSQL(cursor):
  table_names = [("'" + i + "'") for i in picked_tables]



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
      table_name in (""" + ','.join(table_names) + """) and (TABLE_SCHEMA = '""" + connection['name'] + """' or TABLE_CATALOG = '""" + connection['name'] + """')
      order by TABLE_NAMe
  """)

  return createPromptGPT(cursor)

def createPromptGPTMYSQL(cursor):
  table_names = [("'" + i + "'") for i in picked_tables]



  cursor.execute("""SELECT distinct column_name, table_name, data_type, A.ref as ref_table, A.RECOLNAME as ref_column FROM information_schema.COLUMNS 
    left join (select   c.REFERENCED_TABLE_NAME as REF,
      c.COLUMN_NAME as COLNAME,
      c.REFERENCED_COLUMN_NAME as RECOLNAME,
      c.TABLE_NAME as PARENT
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE c
    ) A on PARENT = table_name and COLNAME = column_name and REF is not null
    WHERE table_name in (""" + ','.join(table_names) + """) and TABLE_SCHEMA = '""" + connection['name'] + """' 
      order by TABLE_NAMe
  """)
  return createPromptGPT(cursor)

db = sys.argv[1]
if (db == None):
  raise Exception('No db')

mydb = mysql.connector.connect(
  host=os.getenv("CODEX_DB_HOST"),
  user=os.getenv("CODEX_DB_USER"),
  password=os.getenv("CODEX_DB_PASS"),
  database=os.getenv("CODEX_DB_NAME")
)


needle = sys.argv[2]

if (needle == None):
  raise Exception('No needle')


mycursor = mydb.cursor(dictionary=True)

df = None
fks = {}

mycursor.execute("SELECT * FROM `table` WHERE db = %s", (int(db),))

tables = mycursor.fetchall()

mycursor.execute("SELECT * FROM `db` WHERE id = %s", (int(db),))

connection = mycursor.fetchone()

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

mycursor.execute("SELECT * FROM `connection` WHERE db = %s", (int(db),))

connections = mycursor.fetchall()
schema = []
edges = {}

for table in tables:
  if table['description'] != None:
      name = table['name']
      local_edges = list(map(lambda x: x['to'], filter(lambda x: x['from'] == name, connections)))
      if name in edges:
          edges[name] = edges[name] + local_edges
      else:
          edges[name] = local_edges
      schema.append(name)


file = open('dictionary/' + str(db) + '.dictionary','rb')
encodes = pickle.load(file)
file.close()

file = open('dictionary/' + str(db) + '.relevance','rb')
relevance = pickle.load(file)
file.close()


from sentence_transformers import SentenceTransformer
model = SentenceTransformer('multi-qa-mpnet-base-dot-v1')

[pruningResults, [picked_tables, tables_weights]] = pruning(needle, model)


if (connection['type'] == 'mssql'):

  queries = createPromptGPTSSQL(cursor)

if (connection['type'] == 'mysql'):

  queries = createPromptGPTMYSQL(cursor)



print(json.dumps(queries))
