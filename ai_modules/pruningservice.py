
import pickle
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3' 

import pymssql
import json
from scipy.spatial import distance
import mysql.connector
import sys
from dotenv import load_dotenv
from pathlib import Path
from sentence_transformers import SentenceTransformer

error = 0
dotenv_path = Path(os.path.abspath(__file__) + '../.env')
load_dotenv()

def pruning(mydb, prompt, model, edges, schema, encodes, finalResult = {}):
    import re
    import yake
    prompt = prompt.replace('-', ' ')
    kw_extractor = yake.KeywordExtractor(top=10, stopwords=None)
    keywords = kw_extractor.extract_keywords(prompt)
    keywords = list(sorted(keywords, key=lambda x: x[1], reverse=True))

    keywords = list(map(lambda x: x[0], keywords)) 
    finalResult['keywords'] = keywords

    sentence = model.encode(prompt.lower())
    keys = model.encode(' '.join(keywords))
    tables = schema
    table_sim = {}

    sims = []
    encodedTables = encodes.keys()

    for table in tables:

      iEncoding = list(filter(lambda x: table + '$$' in x, encodedTables))
      if (len(iEncoding) <= 0):
        print('No training. Please, execute the training using the Designer')
        exit()
      maximumLH = 0
      for encodedTable in iEncoding:
        encode = encodes[encodedTable]
        sim = 1 - distance.cosine(sentence, encode)
        sim2 = 1 - distance.cosine(keys, encode)
        lh = (sim + 4 * sim2) / 5
        if lh > maximumLH:
          maximumLH = lh
      table_sim[table] = maximumLH
      sims.append(sim)
    perc = 0.8 * (max(sims))

    table_sim2 = list(filter(lambda x: x[1] >= perc, table_sim.items()))
    sort = list(sorted(table_sim2, key=lambda x: x[1], reverse=True))
    sort2 = list(map(lambda x: x[0], sort))
    for table in table_sim.keys():
      if table in sort2:
        table_sim[table] = table_sim[table] * 1.1

    import copy
    import math

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

    perc = 0.75 * max(tables_weights.values())

    table_sim2 = list(filter(lambda x: x[1] >= perc, tables_weights.items()))
    items = list(tables_weights.items())
    sort = list(sorted(table_sim2, key=lambda x: x[1], reverse=True))
    picked_table_names = list(map(lambda x: x[0], sort))
    table_sim3 = {}
    for i in range(0, len(items)):
      row = items[i]
      table_sim3[row[0]] = row[1]
    return [table_sim3, [picked_table_names, tables_weights]]

def ultimate(mydb, db, prompt, session):   

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
        queryTables = re.findall("(?:from|join)\s+(\w+)", query)
        error = error + 1
        columns = re.findall("Unknown column '(.*?)'", str(e))
        column = columns[0] if len(columns) > 0 else None
        if column != None:
          
          query = re.sub("\s{0,}%(column)s\s{0,}" % { "column": column.replace('.','\.')}, "", query, flags=re.IGNORECASE)
          query = re.sub("\w+\s*\(\s*\)", "", query, flags=re.IGNORECASE)
          query = re.sub("(select\s+|,\s*)as \w+", "", query, flags=re.IGNORECASE)
          query = re.sub(",\s*from", "", query, flags=re.IGNORECASE)
          finalResult['query'] = query
          execute(query, cursor, fks)
        
      else:
        finalResult['jumps'] = []
    except:
      finalResult['jumps'] = []

  def createQueryGPT(gpt_prompt):
    import openai
    openai.api_key = os.getenv("GPT_CODEX_API_KEY")

    response = openai.ChatCompletion.create(
      model="gpt-3.5-turbo",
      messages=[{
        "role": "user", "content": gpt_prompt
      }],
      temperature=0,
      max_tokens=150,
      top_p=0.5
    )

    
    response = response['choices'][0]['message']['content']


    topper = ''
    limit = ''
    if connection['type'] == 'mssql':
      topper = "top(15) " if 'top' not in response.lower() and 'distinct' not in response.lower() else ''
    elif connection['type'] == 'mysql':
      limit = " limit 15 " if 'limit' not in response.lower() else ''
    query = ("SELECT " + topper + response.replace(';',"") + limit).replace('\\n','').replace('\\r','')
    query = query.replace('SELECT SELECT', 'SELECT')

    if ('delete' in query or 'update' in query or 'insert' in query or 'drop' in query or 'alter' in query):
      finalResult['results'] = []
      step = 2
    #query = "SELECT top(15)  Cd_Agente1, COUNT(*) as x FROM OrdineTes GROUP BY Cd_Agente1 ORDER BY Cd_Agente1"
    finalResult['query'] = query

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

    cols = {}
    fkText = ""

    if connection['type'] == 'mysql':
      cursor = cursor.fetchall()
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
        fkText = fkText + row['table_name'] + "." + row['column_name'] + " -> " + row["ref_table"] + "." + row["ref_column"] + "\n"
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
    # MANCANO DA INVIARE LE FK
    gpt_prompt = 'Use LIKE and description or name columns. DO NOT VALUE PARAMETERS IF NOT REQUESTED. SCHEMA HAS ALL THE EXISTING COLUMN. NO OTHER COLUMN EXISTS. Use alias for COUNT, MAX, SUM, MIN, AVG\n\n' + connection['type'] + ' schema:\n' + schema + '# foreign keys: ' + fkText + '\n#last query:' + lastQuery + '\n#new prompt:' + prompt + '\nSELECT'

    finalResult['gpt_prompt'] = gpt_prompt

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
        table_name in (""" + ','.join(table_names) + """) and TABLE_SCHEMA = '""" + connection['name'] + """' 
        order by TABLE_NAMe
    """)

    createPromptGPT(cursor)

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
    createPromptGPT(cursor)

  def createPromptGPTCSVJSON():
    import pandas as pd
    if connection['type'] == 'csv':
      df = pd.read_csv(connection['server'])
    elif connection['type'] == 'json':
      df = pd.read_json(connection['server'])

    schema = 'df:'
    for col in df:
      schema = schema + '|' + col

    gpt_prompt = 'Use LIKE and description or name columns. Use alias for COUNT, MAX, SUM, MIN, AVG\n\nSQL schema:\n' + schema + '#last query:' + lastQuery + '\n#new prompt:' + prompt + '\nSELECT'

    finalResult['gpt_prompt'] = gpt_prompt

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
    return json.dumps(finalResult)

  if (db == None):
    raise Exception('No db')


  


  if (prompt == None):
    raise Exception('No prompt')


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

  mycursor.execute("SELECT query FROM `log` WHERE db = %s and prompt = %s and query <> '' order by timestamp desc", (int(db), prompt,))

  queries = mycursor.fetchall()

  mycursor.execute("SELECT query FROM `log` WHERE db = %s and session = %s and query <> '' order by timestamp desc limit 1", (int(db), session,))

  last = mycursor.fetchone()
  lastQuery = last['query'] if not last == None else ''

  fks = {}

  finalResult = {}

  if len(queries) > 0:
    import yake
    prompt = prompt.replace('-', ' ')
    kw_extractor = yake.KeywordExtractor(top=10, stopwords=None)
    keywords = kw_extractor.extract_keywords(prompt)
    keywords = list(sorted(keywords, key=lambda x: x[1], reverse=True))

    keywords = list(map(lambda x: x[0], keywords)) 
    finalResult['keywords'] = keywords
    execute(queries[0]['query'], cursor, fks)
    finalResult['query'] = queries[0]['query']
    finalResult['cached'] = True
    return finalize()

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

  file = open(os.path.dirname(__file__) + '/../dictionary/' + str(db) + '.dictionary','rb')
  encodes = pickle.load(file)
  file.close()


  from sentence_transformers import SentenceTransformer
  model = SentenceTransformer('multi-qa-mpnet-base-dot-v1')

  [pruningResults, [picked_tables, tables_weights]] = pruning(prompt, model, edges, schema, encodes, finalResult)

  finalResult['pruning'] = pruningResults

  finalResult['jumps'] = []


  if (connection['type'] == 'mssql'):

    createPromptGPTSSQL(cursor)

  if (connection['type'] == 'mysql'):

    createPromptGPTMYSQL(cursor)

  if (connection['type'] == 'csv' or connection['type'] == 'json'):

    createPromptGPTCSVJSON(cursor)


  createQueryGPT(finalResult['gpt_prompt'])

  execute(finalResult['query'], cursor, fks)

  return finalize()

def insertPruning(mydb, db, prompt):

  if (db == None):
    raise Exception('No db')


  if (prompt == None):
    raise Exception('No prompt')


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

  file = open(os.path.dirname(__file__) + '/../dictionary/' + str(db) + '.dictionary','rb')
  encodes = pickle.load(file)
  file.close()


  from sentence_transformers import SentenceTransformer
  model = SentenceTransformer('multi-qa-mpnet-base-dot-v1')

  [pruningResults, [picked_tables, tables_weights]] = pruning(mydb, prompt, model, edges, schema, encodes)

  table = picked_tables[0]

  mycursor.execute("""SELECT c.name as name FROM `columns` as c left join `table` as t on c.table = t.id WHERE t.name = %s and t.db = %s""", (table, int(db),))

  columns = list(mycursor.fetchall())
  columns = list(map(lambda x: x['name'], columns))
  print(table)

  results = {
    'columns': columns,
    'table': table
  }

  gpt_prompt = 'Create a SQL insert query into %s given this prompt: %s\nINSERT' % (('%s(%s)' % (table, ','.join(columns))), prompt)

  import openai
  openai.api_key = os.getenv("GPT_CODEX_API_KEY")

  response = openai.ChatCompletion.create(
    model="gpt-3.5-turbo",
    messages=[{
      "role": "user", "content": gpt_prompt
    }],
    temperature=0,
    max_tokens=150,
    top_p=0.5
  )

  
  response = response['choices'][0]['message']['content']
  res = {
    'query': response
  }

  return json.dumps(res)


