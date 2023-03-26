
import pickle
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3' 

import pymssql
import json
import sys
import mysql.connector
import sys
from dotenv import load_dotenv
from pathlib import Path
from sentence_transformers import SentenceTransformer

error = 0
dotenv_path = Path(os.path.abspath(__file__) + '../.env')
load_dotenv()

def execute(query, cursor, fks):
  global error
  try:
    finalResult['results'] = []
    if (connection['type'] == 'csv' or connection['type'] == 'json') and df is not None:
      import pandasql as ps
      cursor = ps.sqldf(query, locals()).to_json(orient="records")
      cursor = json.loads(cursor)
      fks = None
    else:
      cursor.execute(query)
    if connection['type'] == 'mysql':
      cursor = cursor.fetchall()
    extractedCols = []
    for row in cursor:
      for col in row.keys():
        if not row[col] == None and (not (type(row[col]) == int or type(row[col]) == float)):
            row[col] = str(row[col])
      finalResult['results'].append(row)
    if (len(finalResult['results']) > 0):
      extractedCols = finalResult['results'][0].keys()
    finalResult['jumps'] = []
    if not fks == None or table not in fks:
      for table in fks.keys():
        finalResult['jumps'] = finalResult['jumps'] + list(filter(lambda x: x['from'] in extractedCols, fks[table]))          
  except mysql.connector.Error as e:
    if error < 2:
      import re
      error = error + 1
      columns = re.findall("Unknown column '(.*?)'", str(e))
      column = columns[0]
      if column != None:
        
        query = re.sub("\s{0,}%(column)s\s{0,}" % { "column": column.replace('.','\.')}, query, flags=re.IGNORECASE)
        query = re.sub("\w+\s*\(\s*\)", "", query, flags=re.IGNORECASE)
        query = re.sub("(select\s+|,\s*)as \w+", "", query, flags=re.IGNORECASE)
        query = re.sub(",\s*from", "", query, flags=re.IGNORECASE)
        finalResult['query'] = query
        execute(query, cursor, fks)
      
    else:
      finalResult['jumps'] = []
  except:
    finalResult['jumps'] = []

def finalize():    
  if 'jumps' not in finalResult:
    finalResult['jumps'] = []
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
    with open(os.path.dirname(__file__) + '\\..\\temp\\' + session, 'w') as f:
        f.write(value)
  print(json.dumps(finalResult))
  sys.stdout.flush()

db = sys.argv[1]
if (db == None):
  raise Exception('No db')


mydb = mysql.connector.connect(
  host=os.getenv("CODEX_DB_HOST"),
  user=os.getenv("CODEX_DB_USER"),
  password=os.getenv("CODEX_DB_PASS"),
  database=os.getenv("CODEX_DB_NAME")
)


query = sys.argv[2]

session = sys.argv[3]
if (query == None):
  raise Exception('No query')


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

import re

queryTables = re.findall("(?:from|join)\s+(\w+)", query, re.IGNORECASE)

fks = {}

if connection['type'] == 'mssql':
  table_names = [("'" + i + "'") for i in queryTables]



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
      table_name in (""" + ','.join(table_names) + """) and TABLE_SCHEMA = '""" + connection['name'] + """' 
      order by TABLE_NAMe
  """)
elif connection['type'] == 'mysql':
  table_names = [("'" + i + "'") for i in queryTables]


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


whereClause = ','.join(list(map(lambda x: str(x['id']), tables)))
mycursor.execute("""SELECT concat(t.name, '.', ifnull(c.name, '*')) as name FROM `columns` as c left join `table` as t on c.table = t.id WHERE t.id in (""" + whereClause + """) 
                  UNION 
                  SELECT concat(t.name, '.', ifnull(c.name, '*')) as name FROM codex.`columns` as c right join codex.`table` as t on c.table = t.id WHERE t.id in (""" + whereClause + """)""")

metaColumns = mycursor.fetchall()
if metaColumns is not None:
  metaColumns = list(map(lambda x: x['name'], metaColumns))

tagged_table_names = list(map(lambda x: x['name'], tables))

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

finalResult = {}

mycursor.execute("SELECT * FROM `connection` WHERE id = %s", (int(db),))

connections = mycursor.fetchall()
schema = []
edges = {}

finalResult['pruning'] = {}

finalResult['jumps'] = []

finalResult['query'] = query
execute(finalResult['query'], cursor, fks)

finalize()

