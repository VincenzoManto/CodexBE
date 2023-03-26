import nltk
nltk.download('stopwords', quiet=True)
nltk.download('punkt', quiet=True)
nltk.download('wordnet', quiet=True)
import spacy
try:
    spacy.load("en_core_web_sm", quiet=True) # download first
except:
    spacy.download("en_core_web_sm", quiet=True)
import collections
from collections import abc
collections.MutableMapping = abc.MutableMapping
from nl4dv import NL4DV #pip install python-Levenshtein requires Visual C++ 14
import os
import altair as alt
import pandas as pd
import sys
from os.path import exists
# Initializing NL4DV with a Housing Dataset
data_url = os.path.dirname(__file__) + '\\..\\temp\\' + sys.argv[1]

if (not exists(data_url)):
    raise Exception("No file")
data = pd.read_json(data_url)

label_attribute = None
dependency_parser_config = {"name": "spacy", "model": "en_core_web_sm", "parser": None}
nl4dv_instance = NL4DV(verbose=False, 
                       debug=True, 
                       data_value = data,
                       dependency_parser_config=dependency_parser_config
                       )

response = nl4dv_instance.analyze_query(sys.argv[2])
script = alt.display.html_renderer(response['visList'][0]['vlSpec'])
script = script['text/html'].replace('"data": {"url": null, "format": {"type": null}}','"data":{"values":' + data.to_json(orient='records') + "}")
print(script)
#with open('index.html', 'w') as f:
    #f.write(script)
