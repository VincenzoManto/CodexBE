import numpy as np
import sys

# Category -> words
data = {
  'Name': ['john','jay','dan','nathan'],
  'Surname': ['smith','johnson','williams','brown','jones','garcia','miller','rodriguez','davis','lopez'],
  'Color': ['yellow', 'red', 'green'],
  'Place': ['tokyo','bejing','washington']
}
# Words -> category
categories = {word: key for key, words in data.items() for word in words}

# Load the whole embedding matrix
embeddings_index = {}
with open('data/glove.6B.100d.txt', encoding="utf8") as f:
  for line in f:
    values = line.split()
    word = values[0]
    embed = np.array(values[1:], dtype=np.float32)
    embeddings_index[word] = embed

print('Loaded %s word vectors.' % len(embeddings_index))
# Embeddings for available words
data_embeddings = {key: value for key, value in embeddings_index.items() if key in categories.keys()}

# Processing the query
def process(query):
  query_embed = embeddings_index[query]
  scores = {}
  for word, embed in data_embeddings.items():
    category = categories[word]
    dist = query_embed.dot(embed)
    dist /= len(data[category])
    scores[category] = scores.get(category, 0) + dist
  return scores

def category(query):
  try:
    tokens = query.split()
    tokens = [x.replace(',', '') for x in tokens]
    result = process(query)
    return max([x for x in result], key=lambda k: result[k])
  except Exception as e:
    print(e)
    return 'N/A'

# Testing
result = category(sys.argv[2])
print(result)
