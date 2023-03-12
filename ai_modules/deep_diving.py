
import pickle

import pymssql
import json
import sys
import mysql.connector
import sys
import datetime




db = sys.argv[1]
if (db == None):
    raise Exception('No db')

mydb = mysql.connector.connect(
  host="localhost",
  user="root",
  password="1234",
  database="codex"
)

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

mycursor = mydb.cursor(dictionary=True)

mycursor.execute("SELECT * FROM `db` WHERE id = %s", (int(db),))

connection = mycursor.fetchone()

finalResult = {}
finalResult['query'] = query
try:
    
    if (connection['type'] == 'mssql'):
        conn = pymssql.connect(connection['server'], connection['username'], connection['password'], connection['name'])
        cursor = conn.cursor(as_dict=True)
        finalResult['results'] = []
        cursor.execute(query)
        extractedCols = []
        for row in cursor:
            for col in row.keys():
                if (not (type(row[col]) == int or type(row[col]) == float)):
                    row[col] = str(row[col])
            finalResult['results'].append(row)
        if (len(finalResult['results']) > 0):
            extractedCols = finalResult['results'][0].keys()
        finalResult['jumps'] = []
except:
    finalResult['results'] = []

value = json.dumps(finalResult['results'])
with open('temp/' + session, 'w') as f:
    f.write(value)
print(json.dumps(finalResult))
sys.stdout.flush()
