const { uniq, sum } = require('lodash');

module.exports = {
    getScatter(request, data) {
        const types = this.getTypes(data);
        const keys = Object.keys(types);
        const shuffledArray = keys.sort((a, b) => 0.5 - Math.random());
        let series = [];
        let name, x, y, z, serieType;

        for (const type of shuffledArray) {
            if (types[type] === 'string' && !serieType && uniq(data.map(e => e[type])).length <= 5) {
                series = uniq(data.map(e => e[type]));
                serieType = type;
            } else if (types[type] === 'string' && !name) {
                name = type;
            } else if (!x) {
                x = type;
            } else if (!y) {
                y = type;
            } else if (!z && !['date', 'year'].includes(types[type])) {
                z = type;
            }
        }
        if (!series.length) {
            series = ['u'];
        }
        const newData = data.map(e => {
            const row = [];
            for(var key in e) {
                row.push(e[key]);
            }
            return row;
        });

        const seriesReal = [];
        for (const serie of series) {
            seriesReal.push( {
                name: serie,
                data: newData.filter(e => series.length === 1 || e[keys.findIndex(d => d === serieType)] === serie),
                type: 'scatter',
                symbolSize: function (data) {
                    if (z) {
                        return data[keys.findIndex(e => e === z)]
                    } else {
                        return 10;
                    }
                },
                emphasis: {
                  focus: 'series',
                  label: {
                    show: true,
                    formatter: function (param) {
                        if (name) {
                            return param.data[keys.findIndex(e => e === name)];
                        } else {
                            return param.data[keys.findIndex(e => e === x)] + ' ' + param.data[keys.findIndex(e => e === y)];
                        }
                    },
                    position: 'top'
                  }
                }
              });
        }

        return { 
            title: {
              text: request
            },
            grid: {
              left: '8%',
              top: '10%'
            },
            xAxis: {
              splitLine: {
                lineStyle: {
                  type: 'dashed'
                }
              }
            },
            yAxis: {
              splitLine: {
                lineStyle: {
                  type: 'dashed'
                }
              },
              scale: true
            },
            series: seriesReal
          };
    },
    getLine(request, data) {
        const types = this.getTypes(data);
        const keys = Object.keys(types);
        const shuffledArray = keys.sort((a, b) => 0.5 - Math.random());
        let series = [];
        let x, y, serieType;

        for (const type of shuffledArray) {
            if (types[type] === 'string' && !serieType && uniq(data.map(e => e[type])).length <= 3) {
                series = uniq(data.map(e => e[type]));
                serieType = type;
            } else if (!x) {
                x = type;
            } else if (!y && types[type] === 'number') {
                y = type;
            }
        }
        if (!series.length) {
            series = ['u'];
        }
        const newData = data.map(e => {
            const row = [];
            for(var key in e) {
                row.push(e[key]);
            }
            return row;
        });

        const seriesReal = [];
        for (const serie of series) {
            const rows = newData.filter(e => series.length === 1 || e[keys.findIndex(d => d === serieType)] === serie).map(e => ({
                x: e[keys.findIndex(d => d === x)],
                y: e[keys.findIndex(d => d === y)]
            }));
            const xs = uniq(data.map(e => e[x]));
            const finalRows = [];
            for (const col of xs) {
                finalRows.push(sum((rows.filter(e => e.x === col)).map(e => +e.y)));
            }
            seriesReal.push( {
                name: serie,
                data: finalRows,
                type: 'line'                
            });
        }

        return  {
            xAxis: {
              data: uniq(data.map(e => e[x]))
            },
            yAxis: {
              type: 'value'
            },
            series: seriesReal
          };
    },

    getPie(request, data) {
        const types = this.getTypes(data);
        
        const keys = Object.keys(types);
        const shuffledArray = keys.sort((a, b) => 0.5 - Math.random());
        let series = [];
        let name, value;

        for (const type of shuffledArray) {
            if (types[type] === 'string') {
                if (!name) {
                    name = type;
                }
            } else if (types[type] === 'number') {
                if (!value) {
                    value = type;
                }
            }
        }
        if (!series.length) {
            series = ['u'];
        }
        return {
            title: {
              text: request
            },
            tooltip: {
              trigger: 'item'
            },
            legend: {
              orient: 'vertical',
              left: 'left'
            },
            series: [
              {
                type: 'pie',
                data: data.map(e => ({
                    value: e[value],
                    name: e[name]
                }))
              }
            ]
          };
    },

    getPieBar(request, data) {
        const types = this.getTypes(data);
        const keys = Object.keys(types);
        const shuffledArray = keys.sort((a, b) => 0.5 - Math.random());
        let series = [];
        let name, value, serieType;

        for (const type of shuffledArray) {
            if (types[type] === 'string') {
                if (!serieType && uniq(data.map(e => e[type])).length <= 5) {
                    series = uniq(data.map(e => e[type]));
                    serieType = type;
                } else if (!name) {
                    name = type;
                }
            } else if (types[type] === 'number') {
                if (!value) {
                    value = type;
                }
            }
        }
        if (!series.length) {
            series = ['u'];
        }
        const seriesReal = [];
        for (const serie of series) {
            const rows = data.filter(e => !serieType || series.length === 1 || e[serieType] === serie).map(e => ({
                x: e[name],
                y: e[value]
            }));
            const xs = uniq(data.map(e => e[name]));
            const finalRows = [];
            for (const col of xs) {
                finalRows.push(sum((rows.filter(e => e.x === col)).map(e => +e.y)));
            }
            seriesReal.push( {
                type: 'bar',
                data: finalRows,
                coordinateSystem: 'polar',
                name: serie,
                stack: 'a',
                emphasis: {
                  focus: 'series'
                }
              });
        }
        return {
            angleAxis: {
              type: 'category',
              data: uniq(data.map(e => e[name]))
            },
            radiusAxis: {},
            polar: {},
            series: seriesReal,
            legend: {
              show: true,
              data: series
            }
          };
    },

    getBar(request, data) {
        const types = this.getTypes(data);
        const keys = Object.keys(types);
        const shuffledArray = keys.sort((a, b) => 0.5 - Math.random());
        let subCat = [];
        let cat = [];
        let value, subCatType, catType;

        for (const type of shuffledArray) {
            if (types[type] === 'string') {
                if (!catType && uniq(data.map(e => e[type])).length <= 5) {
                    cat = uniq(data.map(e => e[type]));
                    catType = type;
                } else if (!subCatType && uniq(data.map(e => e[type])).length <= 5) {
                    console.log(type);
                    subCat = uniq(data.map(e => e[type]));
                    subCatType = type;
                }
            } else if (types[type] === 'number') {
                if (!value) {
                    value = type;
                }
            }
        }
        const seriesReal = [];
        for (const category of cat) {
            const row = {};
            row[catType] = category;
            if (!subCat.length) {
                row['value'] =  sum(data.filter(e => e[catType] === category).map(e => +e[value]))
            } else {
                for (const subcat of subCat) {
                    row[subcat] = sum(data.filter(e => e[subCatType] === subcat && e[catType] === category).map(e => +e[value]));
                }
            }
            seriesReal.push(row);
        }
        return {
            legend: {},
            tooltip: {},
            dataset: {
              dimensions: [catType, ...subCat],
              source: seriesReal
            },
            xAxis: { type: 'category' },
            yAxis: {},
            // Declare several bar series, each will be mapped
            // to a column of dataset.source by default.
            series: subCat.map(e => ({ type: 'bar' }))
          };
    },

    
}

getTypes = (data) => {
    const firstRow = data[0];
    const types = {};
    for (const value in firstRow) {
        if (!isNaN(+firstRow[value])) {
            types[value] = 'number';
            let year = true;
            for (const i in data) {
                if (i > 20) {
                    break;
                }
                if (!(data[i][value] > 1800 && data[i][value] < 2200)) {
                    year = false;
                }
            }
            if (year) {
                types[value] = 'year';
            }
        } else if (isDate(firstRow[value])) {
            types[value] = 'date';
        } else if (firstRow[value].toString().length < 60) {
            types[value] = 'string';
        } else {
            types[value] = 'invalid';
        }
    }
    return types;
}

var isDate = function (date) {
    return!!(function(d){return(d!=='Invalid Date'&&!isNaN(d))})(new Date(date));
}