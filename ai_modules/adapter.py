'''import pickle
import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3' 
import pymssql
import json
import sys
import mysql.connector as myc
import sys
from dotenv import load_dotenv
from pathlib import Path
from sentence_transformers import SentenceTransformer

error = 0
dotenv_path = Path(os.path.abspath(__file__) + '../.env')
load_dotenv()

encodedDictionaries = {}

files = os.scandir(os.path.dirname(__file__) + '\\..\\dictionary')
for file in files:
    if ('dictionary' in file.name):
        fileX = open(file.path, 'rb')
        encodedDictionaries[file.name.replace('.dictionary', '')] = pickle.load(fileX)   
        fileX.close()

'''
import sys
import socket
import struct

HOST = "127.0.0.1"  # The server's hostname or IP address
PORT = 65432  # The port used by the server

def recvall(sock):
    BUFF_SIZE = 4096 # 4 KiB
    data = b''
    while True:
        part = sock.recv(BUFF_SIZE)
        data += part
        if len(part) < BUFF_SIZE:
            # either 0 or end of data
            break
    return data

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.connect((HOST, PORT))
    s.sendall('|||'.join(sys.argv[1:]).encode('utf-8'))
    res = recvall(s).decode('utf-8')
    if '<ERROR>' in res:
        raise Exception(res)
    print(res)