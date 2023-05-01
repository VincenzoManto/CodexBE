import warnings
warnings.filterwarnings("ignore")
import pandas as pd
import os

import sys
from os.path import exists
import math
import random
import json
from dotenv import load_dotenv
from pathlib import Path

def validatePhone(number):
    import re
    pattern = re.compile("^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$")
    return pattern.match(number)

dotenv_path = Path(os.path.abspath(__file__) + '../.env')
load_dotenv()
data_url = os.path.dirname(__file__) + '\\..\\temp\\' + sys.argv[1]
keywords = json.loads(sys.argv[2])

if (not exists(data_url)):
    raise Exception("No file")
data = pd.read_json(data_url, convert_dates=True)
stat = data.describe()

sentences = {
    "relevant": "\nA semantic significant dimension can be column [x]",
    "column_analysis": "\nA column statistically interesting is [x] with variance of [std].\n\tIt ranges from [min] ([argmin]) to [max] ([argmax]), with a mean of [mean]",
    "unrelevant_low": "\nThere exists some unrelevant dimensions",
    "unrelevant_zero": "\nAll the dimensions seems to be relevant and valued",
    "unrelevant_high": "\nA lot of columns appears to be unrelevant",
    "count": "\nFor this extraction, total number of records is [count]"
}

total_length = len(data. index)
relevant = []
unrelevant = []
import datetime

countryInfo = pd.read_json(
  'https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/all/all.json'
)

countryNames = list(countryInfo['name'])
countryA2 = list(countryInfo['alpha-2'])
countryA3 = list(countryInfo['alpha-3'])

mapColumn = None
dateColumn = None
for col in data:
  uniques = pd.unique(data[col])
  if data[col][0] in countryNames or data[col][0] in countryA2 or data[col][0] in countryA3:
    mapColumn = col
  if len(uniques) > 0.75 * total_length:
    relevant.append(col)
  if len(list(filter(lambda x: str(x) not in str([None, 'nan', 'NaN', 0]), uniques))) == 0:
    unrelevant.append(col)
  if isinstance(data[col][0] , datetime.date) or isinstance(data[col][0] , datetime.datetime):
    dateColumn = col
if len(relevant) > 0:
  sentences['relevant'] = sentences['relevant'].replace('[x]', relevant[0])


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
if mapColumn is not None and total_length > 0:
  from vega_datasets import data as vegaDT
  relevantId = 0
  while relevantId < len(relevant) - 1 and mapColumn == relevant[relevantId] and not isinstance(firstRow[relevant[relevantId]], numbers.Number):
    relevantId = relevantId + 1
  if mapColumn == relevant[relevantId] or not isinstance(firstRow[relevant[relevantId]], numbers.Number):
    relevantId = 0
    keys = firstRow.keys()
    while relevantId < len(keys) - 1 and (mapColumn == keys[relevantId] or not isinstance(firstRow[keys[relevantId]], numbers.Number)):
      relevantId = relevantId + 1
    value = keys[relevantId]
  else:
    value = relevant[relevantId]

  value = value.replace('(','').replace(')','')
  geoData = data.copy()
  geoData.columns = geoData.columns.str.replace(r"[()]", "")
  geoData['codex_country_code'] = 0
  newData = geoData.reset_index()
  for index, row in geoData.iterrows():
    x = row[mapColumn]
    country = countryInfo[(countryInfo['name'] == x) | (countryInfo['alpha-2'] == x) | (countryInfo['alpha-3'] == x)]
    if len(country['country-code'].values) > 0:
      geoData.at[index, 'codex_country_code'] = country['country-code'].values[0]
    geoData.at[index, 'id'] = int(index)

  df = geoData[['id', 'codex_country_code', value]]

  countries = alt.topo_feature(vegaDT.world_110m.url, 'countries')

  script = (alt.Chart(countries).mark_geoshape(fill='lightgray')\
    .project('equirectangular')\
    .properties(
        width=400,
        height=300
    ) + alt.Chart(countries).mark_geoshape()\
    .encode(color=alt.Color(value + ':Q'))\
    .transform_lookup(
        lookup='id',
        from_=alt.LookupData(df, key='codex_country_code', fields=[value])
    )\
    .project('equirectangular')).to_html()
elif dateColumn is not None:
  if restat['std'] is not None:
    chart = alt.Chart(data).mark_area(interpolate = 'basis', color = '#007bff') if random.random() > 0.5 else alt.Chart(data).mark_bar(color = '#007bff')
    script = chart.encode(
      x=dateColumn + ':T',
      y=restat['std'] + ":Q").to_html()
  elif len(relevant) > 0 and isinstance(firstRow[relevant[0]], numbers.Number) and validatePhone(firstRow[relevant[0]]):
    script = alt.Chart(data).mark_rect().encode(
      x=alt.X("date(" + dateColumn + "):O", title="Day", axis=alt.Axis(format="%e", labelAngle=0)),
      y=alt.Y("month(" + dateColumn + "):O", title="Month"),
      color=alt.Color("max(" + relevant[0] + ")", legend=alt.Legend(title=None)),
      tooltip=[
          alt.Tooltip("monthdate(" + dateColumn + ")", title="Date"),
          alt.Tooltip("max(" + relevant[0] + ")", title="Max Temp"),
      ],).to_html()
  elif len(relevant) > 0:
    script = alt.Chart(data).mark_bar(color = '#007bff').encode(
      x=dateColumn + ':T',
      y=relevant[0] + ":O").to_html()
    # text + date = barchart
else:
  if restat['std'] is not None:
    relevantId = 0
    while relevantId < len(relevant) and restat['std'] == relevant[relevantId]:
      relevantId = relevantId + 1
    if (len(relevant) > 0 and isinstance(firstRow[relevant[relevantId]], numbers.Number)) and validatePhone(firstRow[relevant[relevantId]]):
      chart = alt.Chart(data).mark_area(interpolate = 'basis', color = '#007bff') if random.random() > 0.5 else alt.Chart(data).mark_point(color = '#007bff')
      script = chart.encode(
        x=restat['std'] + ':Q',
        y=relevant[relevantId] + ":Q").to_html()
      # quantitative + quantitative = line
    elif len(relevant) > 0:
      if random.random() > 0.5:
        script = alt.Chart(data).mark_bar(color = '#007bff').encode(
          x=relevant[relevantId] + ':O',
          y=restat['std'] + ":Q").to_html()
      else:
        script = alt.Chart(data).mark_arc().encode(
          theta=alt.Theta(field=restat['std'], type="quantitative"),
          color=alt.Color(field=relevant[relevantId], type="nominal")).to_html()
      # text + quantitative = bar or pie
  elif (len(relevant) > 0 and isinstance(firstRow[relevant[0]], numbers.Number)) and validatePhone(firstRow[relevant[0]]):
    if (len(relevant) > 1 and isinstance(firstRow[relevant[1]], numbers.Number)) and validatePhone(firstRow[relevant[1]]):
      chart = alt.Chart(data).mark_area(interpolate = 'basis', color = '#007bff') if random.random() > 0.5 else alt.Chart(data).mark_point(color = '#007bff')
      script = chart.encode(
        x=relevant[0] + ':Q',
        y=relevant[1] + ":Q").to_html()
      # quantitative + quantitative = line
    elif len(relevant) > 1:
      if random.random() > 0.5:
        script = alt.Chart(data).mark_bar(color = '#007bff').encode(
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
if total_length > 1:
  for col in newData:
    uniques = pd.unique(newData[col])
    mode = stats.mode(newData[col])

    perc = mode.count[0] / total_length
    if perc > 0.5:
      if perc > 0.9:
        agg = "the totality"
      elif perc > 0.8:
        agg = "the large majority"
      elif perc > 0.7:
        agg = "the majority"
      elif perc > 0.6:
        agg = "the large part"
      else:
        agg = "the sensible part"
      if mode.mode[0] == None or mode.mode[0] == 'nan':
        quantifier = "empty"
      else:
        quantifier = "are equal to " + str(mode.mode[0])
      colData[col] = agg + " of the results " + quantifier + " for about " + str(mode.count[0]) + " results."
      if len(list(set(uniques) - set([mode.mode[0]]))) > 0:
        colData[col] = colData[col] + "The remaining elements are " + ', '.join(map(str,list(set(uniques) - set([mode.mode[0]]))))
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

pretext = ""
if len(data) == 1:
  keys = firstRow.keys()
  if len(keys) == 2:
    pretext = "It's " + str(firstRow[keys[0]]) + " with " + str(firstRow[keys[1]])
  elif len(keys) == 1:
    pretext = "It's " + str(firstRow[keys[0]])
  else:
    pretext = "I found a " + keywords[0] + " with "
    keyIndex = 0
    for key in keys:
      connector = " " if random.random() > 0.5 else " equals to "
      pretext = pretext + str(key) + connector + str(firstRow[key]) + (", " if keyIndex < len(keys) - 1 else '')
      keyIndex = keyIndex + 1


uniqueKeywords = []
for key in keywords:
  uniqueKeywords = uniqueKeywords + key.split(' ')

uniqueKeywords = pd.unique(uniqueKeywords)

sentences['count'] = sentences['count'].replace('[count]', str(total_length))
text = sentences['count'] + sentences['unrelevant'] + sentences['relevant'] + sentences['column_analysis'] + '\n' + colText

gpt_prompt = "Rewrite: " + text + "\nMoreover, tell what this dataset could be referred to given the columns: " + ', '.join(newData.columns)

import openai
openai.api_key = os.getenv("GPT_CODEX_API_KEY")

response = openai.ChatCompletion.create(
    model="gpt-3.5-turbo",
    messages=[{
        "role": "user", "content": gpt_prompt
    }],
    temperature=0.2,
    max_tokens=550,
    top_p=1.0
)

text = response['choices'][0]['message']['content']

finalResult = {
  "pretext": pretext,
  "text": text,
  "chart": script,
  "unrelevant": unrelevant
}
print(json.dumps(finalResult))