const stringSimilarity = require('string-similarity');
const queryEngine = require ('./query-engine.js');
const { QueryTypes, where } = require('sequelize');
const _ = require('lodash');
const { join } = require('path');

module.exports = {
    getDetails: async (fields, connection, query, tables, db, mapping) => {
        let table;
        let lastField;
        for (const field of fields) {
            table = await internalGetTable(connection.id, field, db);
            if (table) {
                lastField = field;
                break;
            }
        }
        if (table) {
            const joinNames = [
                randomCode(),
                randomCode(),
                randomCode(),
                randomCode()
            ]
            const primaryKeys = []; //attributes[connection.id.toString()][table]?.pk;
            const columns = mapping[lastField]?.split(',');
            const joinClause = [];
            for (const i in columns) {
                joinClause.push(`${joinNames[0]}.${columns[i]} = ${joinNames[1]}.${primaryKeys[i]}`);
            }
            const joinClauseString = joinClause.join(' AND ');
            let queryDetails;
            if (connection.type === 'MYSQL') {
                queryDetails = `SELECT * from (${query}) as ${joinNames[0]} natural join ${table}`; 
            } else if (connection.type === 'MSSQL') {
                queryDetails = `SELECT * from (${query}) as ${joinNames[0]} left join ${table} as ${joinNames[1]} on ${joinClauseString}`; 
            } else {
                queryDetails = `SELECT * FROM (${query}) NATURAL LEFT JOIN ${table}`;
            }

            tables.push(tables);
            tables = _.uniq(tables);
            queryDetails = parseMonths(queryDetails);
            queryDetails = fixQuery(queryDetails);
            const newResults = await queryEngine.executeQuery(query, connection, db);
            return newResults;
        }
        return [];
    },
    staticQueries: async (
        views,
        operations,
        fields,
        groupBy,
        namesOfParameters,
        parameters,
        datePeriod,
        date,
        indipendentOperation,
        frequencyOperator,
        columnOperation,
        columns,
        multiplier,
        joins,
        dbMeta,
        user
    ) => {
        let connectionId;
        let connection;
        let results = [];
        let finalQuery;
        const tables = [];
        for (const view of views) {
            mapping = {};
            const queries = [];
            let table;
            const connections = await dbMeta.Connection.findAll();
            for (const dbConnection of connections) {
                const name = await internalGetTable(dbConnection.id, view, dbMeta, user);
                if (name) {
                    connectionId = dbConnection.id;
                    table = name;
                    tables.push(table);
                    break;
                }
            }

            const newParameters = {};

            for (const paramName of namesOfParameters.filter(e => +e !== 1)) {
                const name = await internalGetTable(connectionId, paramName, dbMeta, user);
                if (name) {
                    newParameters[name] = [paramName, ];
                    tables.push(name);
                }
            }

            if (tables.length > 0) {
                connection = await queryEngine.getConnection(connectionId, dbMeta);
                if (connection.type === 'MYSQL') {
                    let whereJoin = '';
                    const fakeNames = [];
                    let from = '';
                    for (let i = 0; i < tables.length; i++) {
                        const fakeName = randomCode();
                        from = `${tables[i]} as ${fakeName}` + (i < tables.length - 1 ? ', ' : '');
                        fakeNames.push(fakeName);
                    }
                    const fks = await getTableFK(table, connection, dbMeta);
                    let stop = false;
                    for (let i = 1; i < tables.length; i++) {
                        const getFk = fks.filter(e => e['REFERENCED_TABLE_NAME'] === tables[i]);
                        if (getFk?.length <= 0) {
                            stop = true;
                            break;
                        } else {
                            for (const fk of getFk) {
                                const columnName = fk['COLUMN_NAME'];
                                const referenced = fk['REFERENCED_COLUMN_NAME'];
                                whereJoin += ` AND ${fakeNames[0]}.${columnName} = ${fakeNames[i]}.${referenced}`;
                            }
                            const value = ['name'];
                            await internalGetFields(tables[i], connection, dbMeta, ['name'], [], [], true, false, value);
                            namesOfParameters[i - 1] = `${fakeNames[i]}.${value}`;
                        }
                    }
                    if (!stop) {
                        let whereString = getWhereString(namesOfParameters, parameters, datePeriod, date, connection, fields);
                        const query = `SELECT ${columns} FROM ${from} WHERE 1=1 ${whereJoin} AND ${whereString}`;
                        await internalGetFields(table, connection, dbMeta, columns, queries, [], false, false);
                    } else {
                        tables = [table];
                    }
                }
            }


            if (table) {
                connection = await queryEngine.getConnection(connectionId, dbMeta);
                for (const i in operations) {
                    const partitions = operations[i].split('(');
                    operations.splice(i, 1, ...partitions);
                }
                
                if (connection.type !== 'MYSQL') {
                    for (const i in operations) {
                        if (operations[i]?.trim().toLowerCase() === 'len') {
                            operations[i] = 'LENGTH';
                        }
                    }
                    for (const i in indipendentOperation) {
                        if (indipendentOperation[i]?.trim().toLowerCase() === 'len') {
                            indipendentOperation[i] = 'LENGTH';
                        }
                    }
                }

                const dimensions = _.uniq(fields).join(', ');
                const groupByString = groupBy.length > 0 ? ('group by ' + groupBy.join(', ')) : '';
                let whereString = getWhereString(namesOfParameters, parameters, datePeriod, date, connection, fields);
                const compositeOperation = indipendentOperation?.join('(') + '(';
                if (frequencyOperator === 'percentage' && connection.type === 'MYSQL') {              
                    queries.push(`select ${groupBy[0]}, ${columnOperation} / (select sum(${columnOperation}) from ${table} where ${whereString}) as calcPercentage from ${table} where ${whereString} group by ${groupBy[0]} order by calcPercentage desc`);
                    queries.push(`select ${groupBy[0]}, ${columnOperation} / (select sum(${columnOperation}) from ${table} where ${whereString}) as calcPercentage from ${table} where ${whereString} order by calcPercentage desc`);
                    queries.push(`select ${columnOperation} / (select sum(${columnOperation}) from ${table} where ${whereString}) as calcPercentage from ${table} where ${whereString} order by calcPercentage desc`);
                }
                queries.push(`SELECT ${dimensions} from ${table} where ${columnOperation} = (SELECT ${operations[1] ?? 'xx'}(${columnOperation}) from ${table} where ${whereString} group by ${columns.join(', ')}) and ${whereString}`);
                queries.push(`SELECT ${dimensions} from ${table} where ${operations[1]}(${columnOperation}) = (SELECT ${operations[0]}(${operations[1]}(${columnOperation})) from ${table} where ${whereString}) and ${whereString}`);
                queries.push(`SELECT ${dimensions} from ${table} where ${columnOperation} = (SELECT ${operations[1] ?? 'xx'}(${columnOperation}) from ${table} where ${whereString}) and ${whereString}`);
                queries.push(`SELECT ${dimensions} from ${table} where ${columnOperation} > (SELECT ${operations[1] ?? 'xx'}(${columnOperation}) from ${table} where ${whereString}) and ${whereString}`);
                queries.push(`SELECT ${dimensions} from ${table} where ${columnOperation} < (SELECT ${operations[1] ?? 'xx'}(${columnOperation}) from ${table} where ${whereString}) and ${whereString}`);
                queries.push(`SELECT ${dimensions} from ${table} where ${columnOperation} = (SELECT ${operations[0] ?? 'xx'}(${columnOperation}) from ${table} where ${whereString}) and ${whereString}`);
                queries.push(`SELECT ${indipendentOperation}(*) from ${table} where ${whereString}`);
                if (connection.type === 'MYSQL') {
                    queries.push(`SELECT ${columns[0]}, ${operations[0]}(${columnOperation}) as n from ${table}  where ${whereString} group by ${columns[0]} 
                                order by n ${operations[0] === 'max' ? 'desc' : 'asc'} limit 1`);
                    queries.push(`SELECT ${columns[0]}, ${frequencyOperator}(*) as n from ${table}  where ${whereString} group by ${columns[0]} 
                                order by n ${operations[0] === 'max' ? 'desc' : 'asc'} limit 1`);
                }
                else if (connection.type === 'MSSQL') {
                    queries.push(`SELECT top(1) ${columns[0]}, ${operations[0]}(${columnOperation}) as n from ${table}  where ${whereString} group by ${columns[0]} 
                                order by n${operations[0] === 'max' ? 'desc' : 'asc'}`);     
                    queries.push(`SELECT top(1) ${columns[0]}, ${frequencyOperator}(*) as n from ${table}  where ${whereString} group by ${columns[0]} 
                                order by n ${operations[0] === 'max' ? 'desc' : 'asc'}`);     
                            
                }
                else {
                    queries.push(`SELECT ${columns[0]}, ${operations[0]}(${columnOperation}) as n from ${table}  where ${whereString} and ROWNUM <= 1 group by ${columns[0]} 
                                order by n ${operations[0] === 'max' ? 'desc' : 'asc'}`);
                    queries.push(`SELECT ${columns[0]}, ${frequencyOperator}(*) as n from ${table}  where ${whereString} and ROWNUM <= 1 group by ${columns[0]} 
                                order by n ${operations[0] === 'max' ? 'desc' : 'asc'}`);
                }
                queries.push(`SELECT ${[...columns, ...groupBy].join(', ')}, ${multiplier} * ${compositeOperation}${columnOperation}${"(".repeat(indipendentOperation)} from ${table} where ${whereString} ${groupByString}`);
                queries.push(`SELECT ${[...columns, ...groupBy].join(', ')}, ${multiplier} * ${indipendentOperation[0]}(${columnOperation}) from ${table} where ${whereString} ${groupByString}`);
                queries.push(`SELECT ${dimensions} from ${table} where ${whereString} ${groupByString}`);
                queries.push(`SELECT ${dimensions} from ${table} where ${whereString}`);
                if (joins?.length) {
                    queries.push(`SELECT ${dimensions} from ${joins[0]} inner join ${joins[1]} on A. where ${whereString}`);
                }
                console.log(queries);
                await internalGetFields(table, connection, dbMeta, fields, queries, mapping);
                await internalGetFields(table, connection, dbMeta, namesOfParameters.filter(e => e !== '1'), queries, mapping, true);



                for (let query of queries) {
                    if (connection.type === 'MYSQL') {
                        query = `SELECT * from (${query}) as XX LIMIT 10`; 
                    } else if (connection.type === 'MSSQL') {
                        query = `SELECT top(10) * from (${query})`; 
                    } else {
                        query = `SELECT * FROM (${query}) WHERE ROWNUM <= 10`;
                    }
                    query = parseMonths(query);
                    query = fixQuery(query);
                    //console.log(query);
                    results = await queryEngine.executeQuery(query, connection, dbMeta, true);
                    if (results?.length > 0) {
                        finalQuery = query;
                        break;
                    }
                }
                if (results?.length > 0) {
                    break;
                }
            }
        }
        return {
            results: results,
            finalQuery: finalQuery,
            connection: connection,
            tables: tables,
            mapping: mapping
        };
    },
    visualizeWithCard: (arg0) => {
        throw new Error("Function not implemented.");
    },
    mayBeChart: async (results) => {
        if (results?.length > 0) {
            const columns = Object.keys(results[0]);
            console.log(columns);
            if (columns.includes('calcPercentage')) {
                return 'pie';
            }
            if (columns?.length === 2) {
                const row = results[0];
                if ((isDate(row[columns[0]]) && !isNaN(+row[columns[1]]))) {
                    return 'line';
                } else if (isDate(row[columns[1]]) && !isNaN(+row[columns[0]])) {
                    return 'line';
                } else {
                    let column;
                    if (!isNaN(+row[columns[0]]) || row[columns[0]]?.includes('%')) {
                        column = columns[0];
                    } else if (!isNaN(+row[columns[1]]) || row[columns[1]]?.includes('%')) {
                        column = columns[1];
                    }
                    if (column) {
                        let total = 0;
                        for (const record of results) {
                            if (record[column]) {
                                total += +(record[column].toString().replace('%', '').trim()) || 0;
                            }
                        }
                        if (Math.round(total) === 100 || Math.round(total) === 1) {
                            return 'pie';
                        }
                        return 'bar';
                    }
                }
            }
            return 'data';
        }
        return 'text';
    },
    visualize: async (results, connection, tables, mapping, input, query, dbMeta) => {
        const connectionId = connection?.id?.toString();
        if (results?.length > 0) {
            const columns = Object.keys(results[0]);
            if (results?.length === 1 && columns?.length <= 2) {
                const row = results[0];
                for (const column of columns) {
                    let column2Ins = column;
                    const match = column.match(/avg\((.*?)\)/i);
                    if (match?.length > 0) {
                        column2Ins = match[0];
                    }
                    for (const table of tables) {
                        const column = await dbMeta.Column.findOne({
                            where: {
                                name: column2Ins
                            },
                            include: [{
                                model: dbMeta.Table,
                                as: 'COLUMNS',
                                where: {name: table}
                            }]
                        });
                        if (column.unit) {
                            row[column2Ins] = `${column.unit} ${row[column2Ins] || '🕳️'}`;
                            break;
                        }
                    }
                }
                // TODO: GPT3
                outputHTML = `E' ${row[column[0]]} ${row[column[1]] ? `<small>(con ${row[column[1]]})<small>` : ''}`;
                return {
                    output: outputHTML,
                    input: input,
                    query: query
                };
            }
            let outputHTML = '<table><thead><tr>';
            const unitOfMeasurements = [];
            for (const column of columns) {
                let column2Ins = column;
                const match = column.match(/avg\((.*?)\)/i);
                if (match?.length > 0) {
                    column2Ins = match[0];
                }
                for (const table of tables) {
                    const column = await dbMeta.Column.findOne({
                        where: {
                            name: column2Ins
                        },
                        include: [{
                            model: dbMeta.Table,
                            as: 'COLUMNS',
                            where: {name: table}
                        }]
                    });
                    if (column?.unit) {
                        unitOfMeasurements[column] = column.unit;
                        break;
                    }
                }
            }
            
            for (const column of columns) {
                const field = Object.keys(mapping).filter((key) => mapping[key] === column)[0];
                outputHTML += `<th>${field?.replace(/(\(|\))/g, '')}</th>`;
            }
            outputHTML += '</tr></thead><tbody>';
            const rows = results.filter((e, i) => i < 10);
            for (const row of rows) {
                outputHTML += '<tr>';
                for (const column of columns) {
                    outputHTML += `<td>${unitOfMeasurements[column] || ''} ${row[column] || ''}</td>`;
                }
                outputHTML += '</tr>';
            }
            outputHTML += '</tbody></table>';
            return outputHTML;
        
        } else {
            return 'Non sono riuscito a trovare nulla 😢. Potrei aver capito male: se vuoi riprovo a cercare, chiedimi pure!';
        }
    },
    getFields: async (table, connection, db, fields, queries, mapping, areTheyParameters = false, nullable = true, subject = null) => {
        return internalGetFields(table, connection, db, fields, queries, mapping, areTheyParameters, nullable, subject);
    },
    gpt3: async() => {
        /*
        //echo "Il super master 🧠 dice che ";
        $query = gpt3(
            "Crea una query SQL\n\nB:SELECT telefono from clienti where cliente = (SELECT cliente from ordini where totale = (SELECT max(totale) from ordini))\n\nU:$query\nB:",
            $_REQUEST['input']);
        //$query = "SELECT telefono from clienti where cliente = (SELECT cliente from ordini clienti where totale = (SELECT max(totale) from ordini cliente))";
        preg_match_all('/SELECT (.*?) from (.*?)(?:(?: where (.*?)){1} (?:group by (.*?))*|(?:\)|\s|-|#)*$)/', $query, $m);
        $subquery = array();
        foreach ($m[2] as $x => $part) {
            $column = $m[1][$x];
            $params = $m[3][$x];
            $columns = array();
            $parts = explode(",", $column);
            $columns = $parts;
            foreach ($columns as $i => $column) {
                preg_match_all('/\w+\((.*?)\)/', $column, $match);
                if (count($match[1]) > 0) {
                    $columns[$i] = $match[1][0];
                }
            }
            $subquery[] = array("columns" => $columns, "table" => trim($m[2][$x]), "params" => array($params));
        }
        $names = array();
        foreach($subquery as $subq) {
            $view = $subq["table"];
            foreach ($attrs as $conn => $db) {
                $name = getTable($db, $view);
                if ($name) {
                    $names[] = $name;
                    $connection = $conn;
                    //$query = preg_replace("/from(\s+)$view/", "from $name", $query);
                    break;
                }
            } 
        }
        $connectionInfo = get_connessione($connection);
        foreach ($names as $x => $name) {
            $subquery[$x]["newcolumns"] = $subquery[$x]["columns"];
            $subquery[$x]["newparams"] = $subquery[$x]["params"];
            getFields($name, array_unique($subquery[$x]["columns"]), false, false, $subquery[$x]["newcolumns"]);
            getFields($name, array_unique($subquery[$x]["params"]), false, false, $subquery[$x]["newparams"]);
        }
        foreach ($m[0] as $x => $sub) {
            $subq = $sub;
            foreach ($subquery[$x]["columns"] as $y => $column) {
                $subq = str_replace($column, $subquery[$x]["newcolumns"][$y], $subq);
            }
            foreach ($subquery[$x]["params"] as $y => $param) {
                $subq = str_replace($param, $subquery[$x]["newparams"][$y], $subq);
            }
            $query = str_replace($sub, $subq, $query);
        }
        foreach ($names as $x => $name) {
            $view = $subquery[$x]["table"];
            $query = preg_replace("/from(\s+)$view/", "from $name", $query);
        }
        $query = parseMesi($query);
        $query = fix($query);
        //echo $query . " <br><br>";
        $res = execute_total_query($query, $connection);
        results = array();
        foreach ($res as $row) {
            $r = array();
            $x = 0;
            foreach ($row as $field => $val) {
                $r[preg_replace('/(\(|\))/','',$fields[$x++])] = $val;
            }
            results[] = $r;
        }
        */
    },
    dateColumns: (columns) => {
        for (var i = 0; i < columns.length; i++) {
            if (typeof columns[i] !== 'string') {
                continue;
            }
            columns[i] = columns[i].replace(/giorn(o|i) (\w+) settimana/, 'dayname');
            columns[i] = columns[i].replace(/giorn(o|i)/, 'day');
            columns[i] = columns[i].replace(/mes(e|i)/, 'month');
            columns[i] = columns[i].replace(/ann(o|i)/, 'year');
            columns[i] = columns[i].replace(/(month|year|day|dayname){1}?(\s|,||\))/i,'$1(data)$2');
        }
        return columns;
    }
}

function randomCode() {
    const length = 10;
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

function replaceDateable(subject, field, candidate, connection, needle) {
    const dateParticle = field.match(/(month|year|day)\(/i);
    const fieldParts = field.match(/\w+\((.*?)\)/i);
    let internalField = field;
    if (fieldParts?.length > 0) {
        internalField = fieldParts[1];
    }
    if (dateParticle?.length > 0) {
        if (connection.type === 'MYSQL') {
            if (dateParticle[1] === 'semester') {
                return subject.replaceAll(new RegExp(field,'g'), ` FLOOR( ( MONTH(${candidate})-1) / 6 ) + 1`);                        
            } else if (dateParticle[1] === 'year') {
                return subject.replaceAll(new RegExp(field,'g'), ` date_format(${candidate}, '%Y')`,);
            } else if (dateParticle[1] === 'month') {
                return subject.replaceAll(new RegExp(field,'g'), ` date_format(${candidate}, '%m-%Y')`);
            } else {
                console.log(subject.replaceAll(field, ` date_format(${candidate}, '%d-%m-%Y')`));
                return subject.replaceAll(field, ` date_format(${candidate}, '%d-%m-%Y')`);
            }
        } else {
            return  subject.replace(new RegExp(field,'g'), ` to_char('${candidate + ', \'' + dateParticle[1] + '\''})`);
        }
    } else {
        return subject.replace(new RegExp(internalField,'g'),  internalField.replace(needle, ' ' + candidate));
    }
};

function replaceInQuery(queries, field, candidate, connection, needle) {
    for (const i in queries) {
        queries[i] = replaceDateable(queries[i], field, candidate, connection, needle);
    }
}

async function internalGetFields(table, connection, dbMeta, fields, queries, mapping, areTheyParameters = false, nullable = true, subject = null) {
    let queryColumn = `SELECT column_name FROM USER_TAB_COLUMNS  WHERE table_name = '${table}'`;
    if (connection.type === 'MYSQL') {
        queryColumn = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${connection.database}' AND TABLE_NAME='${table}'`;
    } else if (connection.type === 'MSSQL') {
        queryColumn = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}'`;
    }
    const tableColumns = await queryEngine.executeQuery(queryColumn, connection, dbMeta);
    for (const i in fields) {
        if (typeof fields[i] !== 'string') {
            continue;
        }
        let field = fields[i].replace(/as (\w+)/i, '');
        const original = `${field}`;
        const fieldParts = field.match(/\w+\((.*?)\)/i);
        if (fieldParts?.length > 0) {
            field = fieldParts[1];
        }
        let maximumSimilarity = 0;
        let candidate = areTheyParameters ? 1 : '';
        let needle;
        for (const column of tableColumns) {
            const columnMeta = await dbMeta.Column.findOne({
                where: {
                    name: column['COLUMN_NAME']
                },
                include: [{
                    model: dbMeta.Table,
                    as: 'COLUMNS',
                    where: {name: table}
                }]
            });
            const tags = columnMeta?.tags || [];
            for (const tag of tags) {
                needle = field.replace(/(.*?\(|\).*$)/, '')?.trim();
                const similarity = stringSimilarity.compareTwoStrings(needle, tag);
                if (similarity > 0.7 && similarity > maximumSimilarity) {
                    maximumSimilarity = similarity;
                    candidate = column['COLUMN_NAME'].trim();
                }
            }
        }
        if (nullable || (!nullable && maximumSimilarity > 0)) {
            const blocksOfColumns = await dbMeta.Table.findOne({
                where: {
                    name: table
                }
            })?.columnBlocks || [];
            for (const block of blocksOfColumns) {
                if (block.find(candidate)) {
                    candidate = block.join(', ');
                }
            }
            mapping[field] = candidate;
            field = field.trim();
            if (!subject) 
                replaceInQuery(queries, original, candidate, connection, needle);
            else {
                for (const i in subject) {
                    subject[i] = replaceDateable(subject[i], original, candidate, connection, needle);
                }
            }
        }
    }
}

async function internalGetTable(connectionId, tableName, db, user, queries = null) {
    const database = await db.Table.findAll({
        where: {
            connectionId: connectionId
        }
    });
    for (const table of database) {
        if (table.enabledUsers?.length > 0 && !table.enabledUsers.find(e => e === user))
            continue;
        const tags = table.tags || [];
        for (const tag of tags) {
            if (stringSimilarity.compareTwoStrings(tableName, tag) > 0.9) {
                if (queries) {
                    for (const i in queries) {
                        queries[i] = queries[i].replace(tableName, table.name);
                    }
                }
                return table.name.trim();
            }
        }        
    }
    return null;
}

function parse (subject) {
    const array = {
        'Moonday' : 'Lunedì',
        'Tuesday' : 'Martedì',
        'Wednesday' : 'Mercoledì',
        'Thursday' : 'Giovedì',
        'Friday' : 'Venerdì',
        'Saturday' : 'Sabato',
        'Sunday' : 'Domenica'
    };

    for (const key in array) {
        subject = subject.replace(key, array[key]);
    }
    
    return subject;
}



function parseMonths (subject) {
    const array = {
        'gennaio' : 1,
        'febbraio' : 2,
        'marzo' : 3,
        'aprile' : 4,
        'maggio' : 5,
        'giugno' : 6,
        'luglio' : 7,
        'agosto' : 8,
        'settembre' : 9,
        'ottobre' : 10,
        'novembre' : 11,
        'dicembre' : 12
    };

    for (const key in array) {
        subject = subject.replace(key, array[key]);
    }

    return subject;
}

function fixQuery (query) {
    query = query.replace(/select(\s+),/i, 'select ', query);
    query = query.replace(/,(\s+)from/i, ' from', query);
    query = query.replace(/group by(\s+)/i, '', query);
    query = query.replace(/(length|len)\(avg\(/i, 'avg(1(', query);
    query = query.replace(/ (delete|drop|update|insert) /i, '', query);
    return query;
}

function isDate(value) {
    var dateFormat;
    if (toString.call(value) === '[object Date]') {
        return true;
    }
    if (typeof value.replace === 'function') {
        value.replace(/^\s+|\s+$/gm, '');
    }
    dateFormat = /(^\d{1,4}[\.|\\/|-]\d{1,2}[\.|\\/|-]\d{1,4})(\s*(?:0?[1-9]:[0-5]|1(?=[012])\d:[0-5])\d\s*[ap]m)?$/;
    return dateFormat.test(value);
}

async function getTableFK(table, connection, dbMeta) {
    const rows = await queryEngine.executeQuery(`
    SELECT
        CONSTRAINT_NAME,
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
    FROM
        'information_schema'.'KEY_COLUMN_USAGE'
    WHERE
        'table_name' = '${table}'
    AND
        'referenced_column_name' IS NOT NULL
    ORDER BY
        'column_name';`, connection, dbMeta, true);
    return rows;
}

function getWhereString(namesOfParameters, parameters, datePeriod, date, connection, fields) {
    let whereString = '1 = 1';
    for (const i in namesOfParameters) {
        whereString += ` AND (${namesOfParameters[i]} = '${parameters[i]}' 
            OR LOWER('${namesOfParameters[i]}') LIKE LOWER('%${parameters[i]}%'))`;
    }
    if (datePeriod) {
        if (connection.type === 'MYSQL') {
            whereString += ` AND date_format(data, '%Y-%m-%d') >= '${datePeriod.startDate.split('T')[0]}'
                            AND date_format(data, '%Y-%m-%d') <= '${datePeriod.endDate.split('T')[0]}'`;
        } else {
            whereString += ` AND to_char(data, 'YYYY-MM-DD') >= '${datePeriod.startDate.split('T')[0]}'
                            AND  to_char(data, 'YYYY-MM-DD') <= '${datePeriod.endDate.split('T')[0]}'`;
        }
        fields.push('data');
    }
    if (date) {
        if (connection.type === 'MYSQL') {
            whereString += ` AND date_format(data, '%Y-%m-%d') = '{date.split('T')[0]}'`;
        } else {
            whereString += ` AND to_char(data, 'YYYY-MM-DD') = '{date.split('T')[0]}'`;
        }
        fields.push('data');
    }
    return whereString;
}