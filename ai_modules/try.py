# echo-server.py
from pruningservice import *
from data_summarizationservice import *
from data_visualizationservice import *
from deep_divingservice import *
import socket
import time

import signal
import sys
def signal_handler(signal, frame):
        # close the socket here
        sys.exit(0)
signal.signal(signal.SIGINT, signal_handler)

HOST = "127.0.0.1"  # Standard loopback interface address (localhost)
PORT = 65432  # Port to listen on (non-privileged ports are > 1023)

countryInfo = pd.read_json(
'https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json'
)

mydb = mysql.connector.connect(
    host=os.getenv("CODEX_DB_HOST"),
    user=os.getenv("CODEX_DB_USER"),
    password=os.getenv("CODEX_DB_PASS"),
    database=os.getenv("CODEX_DB_NAME")
)

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((HOST, PORT))
        s.listen()
        while True:
            try:
                print("Ready")
                conn, addr = s.accept()
                with conn:
                    start_time = time.time()
                    print(f"Connected by {addr}")
                    while True:
                        try: 
                            data = conn.recv(1024)
                            if not data:
                                break
                            dataStr = data.decode('utf-8').split('|||')
                            print(dataStr)
                            if 'pruning' == dataStr[0]:
                                conn.sendall(ultimate(mydb, dataStr[1], dataStr[2], dataStr[3]).encode('utf-8'))
                                print(time.time() - start_time)
                            if 'summarization' == dataStr[0]:
                                conn.sendall(summarization(mydb, dataStr[1], dataStr[2], countryInfo).encode('utf-8'))
                                print(time.time() - start_time)
                            if 'visualization' == dataStr[0]:
                                conn.sendall(visualization(mydb, dataStr[1], dataStr[2]).encode('utf-8'))
                                print(time.time() - start_time)
                            if 'insert' == dataStr[0]:
                                conn.sendall(insertPruning(mydb, dataStr[1], dataStr[2]).encode('utf-8'))
                                print(time.time() - start_time)
                            if 'deepdiving' == dataStr[0]:
                                conn.sendall(deepDiving(mydb, dataStr[1], dataStr[2], dataStr[3]).encode('utf-8'))
                                print(time.time() - start_time)
                                
                            if 'close' == dataStr[0]:
                                conn.close()
                                s.close()
                                exit(0)
                        except Exception as e:
                            import traceback
                            print(traceback.format_exc())
                            conn.sendall(('<ERROR>: ' + str(e)).encode('utf-8'))
                            pass
            except:
                conn.close()
                raise Exception()