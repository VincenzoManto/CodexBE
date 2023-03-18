import pymssql
import json
import sys
import mysql.connector

class Object(object):
  pass


db = sys.argv[1]
letter = sys.argv[2]
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

if (connection['type'] == 'mssql'):
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
      table_name like '""" + letter + """%' and TABLE_SCHEMA = '""" + connection['name'] + """' 
      order by TABLE_NAMe
  """)

if connection['type'] == 'mysql':
  conn = mysql.connector.connect(
    host=connection['server'],
    user=connection['username'],
    password=connection['password'],
    database=connection['name']
  )
  cursor = conn.cursor(dictionary=True)
  cursor.execute("""SELECT distinct column_name, table_name, data_type, A.ref as ref_table, A.RECOLNAME as ref_column FROM information_schema.COLUMNS 
    left join (select   c.REFERENCED_TABLE_NAME as REF,
      c.COLUMN_NAME as COLNAME,
      c.REFERENCED_COLUMN_NAME as RECOLNAME,
      c.TABLE_NAME as PARENT
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE c
    ) A on PARENT = table_name and COLNAME = column_name and REF is not null
    WHERE table_name like '""" + letter + """%' and TABLE_SCHEMA = '""" + connection['name'] + """' 
      order by TABLE_NAMe
    """)

cols = {}
mycursor = mydb.cursor(dictionary=True)

mycursor.execute("SELECT * FROM `table` WHERE db = %s", (int(db),))

tables = mycursor.fetchall()
tableNames = list(map(lambda x: x['name'], tables))
tableColumns = {}
index = 0
for row in cursor:
  if (row['table_name'] not in cols):
    cols[row['table_name']] = {}
    filtered = list(filter(lambda x: x['name'] == row['table_name'], tables))
    table = None
    if (len(filtered) > 0):
      table = filtered[0]
      mycursor.execute("SELECT * FROM `columns` WHERE `table` = %s", (int(table['id']),))
      tableColumns[row['table_name']] = mycursor.fetchall()
    cols[row['table_name']]['pos'] = {}
    cols[row['table_name']]['pos']['x'] = int(index / 1000) * 200 + 100
    cols[row['table_name']]['pos']['y'] = int(index % 500) + 100
    cols[row['table_name']]['name'] = row['table_name']
    cols[row['table_name']]['columns'] = []
    if (table != None):
      cols[row['table_name']]['id'] = table['id']
      cols[row['table_name']]['description'] = table['description']
      cols[row['table_name']]['fullname'] = table['fullname']
    else:
      cols[row['table_name']]['id'] = 0
    index += 200
  newCol = {}
  if row['table_name'] in tableColumns:
    metaColumn = next((x for x in tableColumns[row['table_name']] if x['name'] == row['column_name']), None)
  else:
    metaColumn = None
  newCol['name'] = row['column_name']
  newCol['type'] = row['data_type']
  newCol['description'] = metaColumn['description'] if metaColumn is not None else None
  newCol['id'] = metaColumn['id'] if metaColumn is not None else 0
  if (row['ref_table'] is not None):
    if (row['ref_table'] in tableNames):
      newCol['fk'] = {}
      newCol['fk']['table'] = row['ref_table']
      newCol['fk']['column'] = row['ref_column']
  cols[row['table_name']]['columns'].append(newCol)


result = {}
result['tables'] = list(cols.values())
print(json.dumps(result))
conn.close()
sys.stdout.flush()


