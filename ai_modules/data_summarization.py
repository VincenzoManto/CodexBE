import warnings
warnings.filterwarnings("ignore")
import pandas as pd
import random

import sys
from os.path import exists
import math
import json

# Initializing NL4DV with a Housing Dataset
data_url = "temp/" + sys.argv[1]
keywords = json.loads(sys.argv[2])

if (not exists(data_url)):
    raise Exception("No file")
data = pd.read_json(data_url, convert_dates=True)
stat = data.describe()

sentences = {
    "relevant": "A semantic significant dimension can be column [x]",
    "date": "A temporal placement is column [x]",
    "column_analysis": "A column statistically interesting is [x] with variance of [std].\n\tIt ranges from [min] ([argmin]) to [max] ([argmax]), with a mean of [mean]",
    "unrelevant_low": "There exists some unrelevant dimensions",
    "unrelevant_zero": "All the dimensions seems to be relevant and valued",
    "unrelevant_high": "A lot of columns appears to be unrelevant",
    "count": "For this extraction, total number of records is [count]"
}

total_length = len(data. index)
relevant = []
unrelevant = []
import datetime

dateColumn = None
for col in data:
  uniques = pd.unique(data[col])
  if len(uniques) > 0.75 * total_length:
    relevant.append(col)
  if len(list(filter(lambda x: str(x) not in str([None, 'nan', 'NaN', 0]), uniques))) == 0:
    unrelevant.append(col)
  if isinstance(data[col][0] , datetime.date) or isinstance(data[col][0] , datetime.datetime):
    dateColumn = col
if len(relevant) > 0:
  sentences['relevant'] = sentences['relevant'].replace('[x]', relevant[0])
if dateColumn is not None:
  sentences['date'] = sentences['date'].replace('[x]', dateColumn)
else:
  sentences['date'] = ''


restat = {
  "std": None
}
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

import numbers
import altair as alt
firstRow = data.iloc[0]
script = None
if dateColumn is not None:
  if restat['std'] is not None:
    chart = alt.Chart(data).mark_line() if random.random() > 0.5 else alt.Chart(data).mark_bar()
    script = chart.encode(
      x=dateColumn + ':date',
      y=restat['std'] + ":Q").to_html()
  elif len(relevant) > 0 and isinstance(firstRow[relevant[0]], numbers.Number):
    script = alt.Chart(data).mark_line().encode(
      x=dateColumn + ':date',
      y=relevant[0] + ":Q").to_html()
  elif len(relevant) > 0:
    script = alt.Chart(data).mark_bar().encode(
      x=dateColumn + ':date',
      y=relevant[0] + ":O").to_html()
    # text + date = barchart
else:
  if restat['std'] is not None:
    if (len(relevant) > 0 and isinstance(firstRow[relevant[0]], numbers.Number)):
      chart = alt.Chart(data).mark_line() if random.random() > 0.5 else alt.Chart(data).mark_point()
      script = chart.encode(
        x=restat['std'] + ':Q',
        y=relevant[0] + ":Q").to_html()
      # quantitative + quantitative = line
    elif len(relevant) > 0:
      if random.random() > 0.5:
        script = alt.Chart(data).mark_bar().encode(
          x=relevant[0] + ':O',
          y=restat['std'] + ":Q").to_html()
      else:
        script = alt.Chart(data).mark_arc().encode(
          theta=alt.Theta(field=restat['std'], type="quantitative"),
          color=alt.Color(field=relevant[0], type="nominal")).to_html()
      # text + quantitative = bar or pie
  elif (len(relevant) > 0 and isinstance(firstRow[relevant[0]], numbers.Number)):
    if (len(relevant) > 1 and isinstance(firstRow[relevant[1]], numbers.Number)):
      chart = alt.Chart(data).mark_line() if random.random() > 0.5 else alt.Chart(data).mark_point()
      script = chart.encode(
        x=relevant[0] + ':Q',
        y=relevant[1] + ":Q").to_html()
      # quantitative + quantitative = line
    elif len(relevant) > 1:
      if random.random() > 0.5:
        script = alt.Chart(data).mark_bar().encode(
          x=relevant[1] + ':O',
          y=relevant[0] + ":Q").to_html()
      else:
        script = alt.Chart(data).mark_arc().encode(
          theta=alt.Theta(field=relevant[0], type="quantitative"),
          color=alt.Color(field=relevant[1], type="nominal")).to_html()




if len(unrelevant) == 0:
  sentences['unrelevant'] = sentences['unrelevant_zero']
  sentences['relevant'] = ''
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
      agg = "a good part"
    elif perc > 0.3:
      agg = "a considerable part"
    elif perc > 0.2:
      agg = "a small part"
    elif perc > 0.1:
      agg = "a minority"
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

colText = ""
x = []

for rp in pd.unique(repeated):
  x = x + new_dict[rp]
  colText = colText + "For " + ', '.join(new_dict[rp]) + " " + rp + "\n"

wrt = ["With regarding to ", "Looking at ", "Refering to ", "Analyzing "]

for key in colData.keys():
  if key not in x:
    colText = colText + wrt[round(random.random() * (len(wrt) - 1))] + key + ", " + colData[key] + "\n"

sentences['count'] = sentences['count'].replace('[count]', str(total_length))
text = "The data refers to " + ','.join(keywords) + '\n' + sentences['count'] + '\n' + sentences['unrelevant'] + '\n' + sentences['relevant'] + '\n' + sentences['column_analysis'] + '\n' + sentences['date'] + '\n' + colText
finalResult = {
  "text": text,
  "chart": script
}
print(json.dumps(finalResult))