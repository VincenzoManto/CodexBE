import warnings
warnings.filterwarnings("ignore")
import pandas as pd
import os

import sys
from os.path import exists
import math
import random
import json
import stat


def chart(data, name):

    total_length = len(data.index)
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



    restat = {
    "std": None
    }
    restat = stat.idxmax(axis=1)
    maxStd = restat['std']

    import numbers
    import altair as alt
    firstRow = data.iloc[0]
    None
    if mapColumn is not None and total_length > 0:
        from vega_datasets import data as vegaDT
        relevantId = 0
        while relevantId < len(relevant) - 1 and mapColumn == relevant[relevantId]:
            relevantId = relevantId + 1
        if mapColumn == relevant[relevantId]:
            relevantId = 0
            keys = firstRow.keys()
            while relevantId < len(keys) - 1 and mapColumn == keys[relevantId]:
             relevantId = relevantId + 1
            value = keys[relevantId]
        else:
            value = relevant[relevantId]

        value = value.replace('(','').replace(')','')
        geoData = data
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

        (alt.Chart(countries).mark_geoshape(fill='lightgray')\
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
            .project('equirectangular')).save(name)
    elif dateColumn is not None:
        if restat['std'] is not None:
            chart = alt.Chart(data).mark_area(interpolate = 'basis', color = '#007bff') if random.random() > 0.5 else alt.Chart(data).mark_bar(color = '#007bff')
            chart.encode(
            x=dateColumn + ':T',
            y=restat['std'] + ":Q").save(name)
        elif len(relevant) > 0 and isinstance(firstRow[relevant[0]], numbers.Number):
            alt.Chart(data).mark_area(interpolate = 'basis', color = '#007bff').encode(
            x=dateColumn + ':T',
            y=relevant[0] + ":Q").save(name)
        elif len(relevant) > 0:
            alt.Chart(data).mark_bar(color = '#007bff').encode(
            x=dateColumn + ':T',
            y=relevant[0] + ":O").save(name)
            # text + date = barchart
    else:
        if restat['std'] is not None:
            relevantId = 0
            while relevantId < len(relevant) and restat['std'] == relevant[relevantId]:
                relevantId = relevantId + 1
            if (len(relevant) > 0 and isinstance(firstRow[relevant[relevantId]], numbers.Number)):
                chart = alt.Chart(data).mark_area(interpolate = 'basis', color = '#007bff') if random.random() > 0.5 else alt.Chart(data).mark_point(color = '#007bff')
                chart.encode(
                    x=restat['std'] + ':Q',
                    y=relevant[relevantId] + ":Q").save(name)
            # quantitative + quantitative = line
            elif len(relevant) > 0:
                if random.random() > 0.5:
                    alt.Chart(data).mark_bar(color = '#007bff').encode(
                    x=relevant[relevantId] + ':O',
                    y=restat['std'] + ":Q").save(name)
                else:
                    alt.Chart(data).mark_arc().encode(
                    theta=alt.Theta(field=restat['std'], type="quantitative"),
                    color=alt.Color(field=relevant[relevantId], type="nominal")).save(name)
            # text + quantitative = bar or pie
        elif (len(relevant) > 0 and isinstance(firstRow[relevant[0]], numbers.Number)):
            if (len(relevant) > 1 and isinstance(firstRow[relevant[1]], numbers.Number)):
                chart = alt.Chart(data).mark_area(interpolate = 'basis', color = '#007bff') if random.random() > 0.5 else alt.Chart(data).mark_point(color = '#007bff')
                chart.encode(
                    x=relevant[0] + ':Q',
                    y=relevant[1] + ":Q").save(name)
                # quantitative + quantitative = line
            elif len(relevant) > 1:
                if random.random() > 0.5:
                    alt.Chart(data).mark_bar(color = '#007bff').encode(
                    x=relevant[1] + ':O',
                    y=relevant[0] + ":Q").save(name)
                else:
                    alt.Chart(data).mark_arc().encode(
                    theta=alt.Theta(field=relevant[0], type="quantitative"),
                    color=alt.Color(field=relevant[1], type="nominal")).save(name)