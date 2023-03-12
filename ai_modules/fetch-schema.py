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
      table_name like '""" + letter + """%'
      order by TABLE_NAMe
  """)

  

  cols = {}
  mycursor = mydb.cursor(dictionary=True)

  mycursor.execute("SELECT * FROM `table` WHERE db = %s", (int(db),))

  tables = mycursor.fetchall()
  index = 0
  for row in cursor:
    if (row['table_name'] not in cols):
      cols[row['table_name']] = {}
      filtered = list(filter(lambda x: x['name'] == row['table_name'], tables))
      table = None
      if (len(filtered) > 0):
        table = filtered[0]
      cols[row['table_name']]['pos'] = {}
      cols[row['table_name']]['pos']['x'] = int(index / 1000) * 200 + 100
      cols[row['table_name']]['pos']['y'] = int(index % 500) + 100
      cols[row['table_name']]['name'] = row['table_name']
      cols[row['table_name']]['columns'] = []
      if (table != None):
        cols[row['table_name']]['id'] = table['id']
        cols[row['table_name']]['description'] = table['description']
      else:
        cols[row['table_name']]['id'] = 0
      index += 200
    newCol = {}
    newCol['name'] = row['column_name']
    newCol['type'] = row['data_type']
    if (row['ref_table'] is not None):
      if (row['ref_table'] in cols):
        newCol['fk'] = {}
        newCol['fk']['table'] = row['ref_table']
        newCol['fk']['column'] = row['ref_column']
    cols[row['table_name']]['columns'].append(newCol)


  result = {}
  result['tables'] = list(cols.values())
  print(json.dumps(result))
  conn.close()
  sys.stdout.flush()


