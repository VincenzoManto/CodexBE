
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

def loadFKMSSQL(cursor):
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
      table_name = '""" + table + """' and TABLE_SCHEMA = '""" + connection['name'] + """' 
      order by TABLE_NAMe
  """)

  loadFK(cursor)

def loadFKMYSQL(cursor):

    cursor.execute("""SELECT distinct column_name, table_name, data_type, A.ref as ref_table, A.RECOLNAME as ref_column FROM information_schema.COLUMNS 
        left join (select   c.REFERENCED_TABLE_NAME as REF,
        c.COLUMN_NAME as COLNAME,
        c.REFERENCED_COLUMN_NAME as RECOLNAME,
        c.TABLE_NAME as PARENT
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE c
        ) A on PARENT = table_name and COLNAME = column_name and REF is not null
        WHERE table_name = '""" + table + """' and TABLE_SCHEMA = '""" + connection['name'] + """' 
        order by TABLE_NAMe
    """)
    cursor = cursor.fetchall()
    loadFK(cursor)


def loadFK(cursor):
    
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
    for row in cursor:
        if (row['table_name'] not in cols):
            cols[row['table_name']] = ''
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
session = sys.argv[2]
jump = json.loads(sys.argv[3])
if (jump == None):
    raise Exception('No jump')


# da revisionare per drilldown su righe multiple
whereClause = '1=1'
refs = jump['to'].split('|')
for i in range(0, len(refs)):
    values = jump['value'][i]
    isNone = None in values
    values = list(filter(lambda x: not x == None, values))
    values = ["'" + str(s) + "'" for s in values]
    whereClause = whereClause + ' and (%(ref)s in (%(values)s) or %(or)s)' % {
        "ref": refs[i] if len(values) > 0 else '1',
        "values": ','.join(values) if len(values) > 0 else '0',
        "or": (refs[i] + ' is null')  if isNone else '1=0'
    }

query = 'select * from %(table)s where %(whereClause)s' % {
    "table": jump['to_table'],
    "whereClause": whereClause
}

fks = {}

table = jump['to_table']

mycursor = mydb.cursor(dictionary=True)

mycursor.execute("SELECT * FROM `db` WHERE id = %s", (int(db),))

connection = mycursor.fetchone()

finalResult = {}
finalResult['query'] = query


try:
    if (connection['type'] == 'mssql'):
        conn = pymssql.connect(connection['server'], connection['username'], connection['password'], connection['name'])
        cursor = conn.cursor(as_dict=True)
        loadFKMSSQL(cursor)
    if (connection['type'] == 'mysql'):
        conn = mysql.connector.connect(
            host=connection['server'],
            user=connection['username'],
            password=connection['password'],
            database=connection['name']
        )
        cursor = conn.cursor(dictionary=True)
        loadFKMYSQL(cursor)
    finalResult['results'] = []
    cursor.execute(query)
    if connection['type'] == 'mysql':
      cursor = cursor.fetchall()
    extractedCols = []

    for row in cursor:
        for col in row.keys():
            if (not (type(row[col]) == int or type(row[col]) == float)):
                row[col] = str(row[col])
        finalResult['results'].append(row)
    if (len(finalResult['results']) > 0):
        extractedCols = finalResult['results'][0].keys()
    finalResult['jumps'] = []
    if not fks == None or table not in fks:
        for table in fks.keys():
            finalResult['jumps'] = finalResult['jumps'] + list(filter(lambda x: x['from'] in extractedCols, fks[table]))
except:
    finalResult['results'] = []

value = json.dumps(finalResult['results'])
with open('temp/' + session, 'w') as f:
    f.write(value)
print(json.dumps(finalResult))
sys.stdout.flush()
