import pandas as pd

import sys
from os.path import exists
# Initializing NL4DV with a Housing Dataset
data_url = "temp/" + sys.argv[1]

if (not exists(data_url)):
    raise Exception("No file")
data = pd.read_json(data_url, convert_dates=True)
stat = data.describe()

sentences = {
    "relevant": "A semantic significant dimensions is column [x]",
    "date": "A temporal placement is column [x]",
    "column_analysis": "A column statistically interesting is [x] with variance of [std]. It ranges from [min] ([argmin]) to [max] ([argmax]), with a mean of [mean]",
    "unrelevant_low": "There exists some unrelevant dimensions",
    "unrelevant_zero": "All the dimensions seems to be relevant and valued",
    "unrelevant_high": "A lot of columns appears to be unrelevant",
    "count": "total records is [count]"
}

total_length = len(data. index)
relevant = []
unrelevant = []
for col in data:
  uniques = pd.unique(data[col])
  if total_length == len(uniques):
    relevant.append(col)
  if len(list(filter(lambda x: str(x) not in str([None, 'nan', 'NaN', 0]), uniques))) == 0:
    unrelevant.append(col)

sentences['relevant'] = sentences['relevant'].replace('[x]', relevant[0])

try:
    restat = stat.idxmax(axis=1)
    maxStd = restat['std']
    sentences['column_analysis'] = sentences['column_analysis'].replace('[x]', restat['std'])
    sentences['column_analysis'] = sentences['column_analysis'].replace('[std]', str(stat[restat['std']]['std']))
    sentences['column_analysis'] = sentences['column_analysis'].replace('[min]', str(stat[restat['std']]['min']))
    sentences['column_analysis'] = sentences['column_analysis'].replace('[argmin]', relevant[0] + ' ' + str(data.iloc[data[restat['std']].idxmin(axis=0)][relevant[0]] if len(relevant[0]) > 0 else '#' + data[restat['std']].idxmin(axis=0)))
    sentences['column_analysis'] = sentences['column_analysis'].replace('[max]', str(stat[restat['std']]['max']))
    sentences['column_analysis'] = sentences['column_analysis'].replace('[argmax]', relevant[0] + ' ' + str(data.iloc[data[restat['std']].idxmax(axis=0)][relevant[0]] if len(relevant[0]) > 0 else '#' + data[restat['std']].idxmax(axis=0)))
    sentences['column_analysis'] = sentences['column_analysis'].replace('[mean]', str(stat[restat['std']]['mean']))
except:
    sentences['column_analysis'] = ''
    #try

if len(unrelevant) == 0:
  sentences['unrelevant'] = sentences['unrelevant_zero']
elif len(unrelevant) > 3:
  sentences['unrelevant'] = sentences['unrelevant_high'].replace('[zero]', ', '.join(unrelevant))
else:
  sentences['unrelevant'] = sentences['unrelevant_low'].replace('[zero]', ', '.join(unrelevant))

newData = data[list(filter(lambda x: x not in unrelevant,[col for col in data]))]

from scipy import stats
colData = {}
for col in newData:
  uniques = pd.unique(newData[col])
  mode = stats.mode(newData[col])

  perc = mode.count[0] / total_length
  if perc > 0.5:
    if perc > 0.9:
      agg = "The totality"
    elif perc > 0.8:
      agg = "The large majority"
    elif perc > 0.7:
      agg = "The majority"
    elif perc > 0.6:
      agg = "The large part"
    else:
      agg = "The sensible part"
    if mode.mode[0] == None or mode.mode[0] == 'nan':
      quantifier = "empty"
    else:
      quantifier = "are equal to " + str(mode.mode[0])
    colData[col] = agg + " of the results " + quantifier + " for about " + str(mode.count[0]) + " results. The remaining elements are " + ', '.join(map(str,list(set(uniques) - set([mode.mode[0]]))))
  else:
    if perc > 0.4:
      agg = "A good part"
    elif perc > 0.3:
      agg = "A considerable part"
    elif perc > 0.2:
      agg = "A small part"
    elif perc > 0.1:
      agg = "A minority"
    else:
      colData[col] = "The heterogeneity is extremely high"
      continue
    if mode.mode[0] == None or mode.mode[0] == 'nan':
      quantifier = "empty"
    else:
      quantifier = "are equal to " + str(mode.mode[0])
    colData[col] = agg + " of the results " + quantifier + " for about "  + str(mode.count[0]) + " results, but a large intracolumn diversity is appreciable"


new_dict = {}
repeated = []
for pair in colData.items():
    if pair[1] not in new_dict.keys():
        new_dict[pair[1]] = []

    new_dict[pair[1]].append(pair[0])
    if len(new_dict[pair[1]]) > 1:
      repeated.append(pair[1])

text = ""
x = []

for rp in pd.unique(repeated):
  x = x + new_dict[rp]
  text = text + "For " + ', '.join(new_dict[rp]) + " " + rp + "\n"

for key in colData.keys():
  if key not in x:
    text = text + "Looking at " + key + " " + colData[key] + "\n"

sentences['count'] = sentences['count'].replace('[count]', str(total_length))
text = sentences['count'] + '\n' + sentences['unrelevant'] + '\n' + sentences['relevant'] + '\n' + sentences['column_analysis']
print(text)