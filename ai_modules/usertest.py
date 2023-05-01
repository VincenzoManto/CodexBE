# echo-server.py
from pruningservice import *
from data_summarizationservice import *
from data_visualizationservice import *
from deep_divingservice import *
from execution import *
from dashboard_pruningservice import *
from data_presentationservice import *
import socket
import time


countryInfo = pd.read_json(
'https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json'
)

mydb = mysql.connector.connect(
    host=os.getenv("CODEX_DB_HOST"),
    user=os.getenv("CODEX_DB_USER"),
    password=os.getenv("CODEX_DB_PASS"),
    database=os.getenv("CODEX_DB_NAME")
)

dataStr = sys.argv[1:]
start_time = time.time()

if 'pruning' == dataStr[0]:
    print(ultimate(mydb, dataStr[1], dataStr[2], dataStr[3]).encode('utf-8'))
    print(time.time() - start_time)
if 'summarization' == dataStr[0]:
    print(summarization(mydb, dataStr[1], dataStr[2], countryInfo).encode('utf-8'))
    print(time.time() - start_time)
if 'visualization' == dataStr[0]:
    print(visualization(mydb, dataStr[1], dataStr[2]).encode('utf-8'))
    print(time.time() - start_time)
if 'insert' == dataStr[0]:
    print(insertPruning(mydb, dataStr[1], dataStr[2]).encode('utf-8'))
    print(time.time() - start_time)
if 'deepdiving' == dataStr[0]:
    print(deepDiving(mydb, dataStr[1], dataStr[2], dataStr[3]).encode('utf-8'))
    print(time.time() - start_time)
if 'execution' == dataStr[0]:
    print(hardExecution(mydb, dataStr[1], dataStr[2], dataStr[3]).encode('utf-8'))
    print(time.time() - start_time)
if 'dashboard' == dataStr[0]:
    print(dashboardCreation(mydb, dataStr[1], dataStr[2]).encode('utf-8'))
    print(time.time() - start_time)
if 'exportPPTX' == dataStr[0]:
    print(presentData(mydb, dataStr[1], dataStr[2], dataStr[3]).encode('utf-8'))
    print(time.time() - start_time)
    

                     