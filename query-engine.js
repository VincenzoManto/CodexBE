const oracledb = require('oracledb');
//const odbc = require('odbc');
const mysql = require('mysql2');
const { Client } = require('ssh2');
const pg = require('pg');
const exec = require('await-exec')
const jsonSql = require('jsonsql');
const mysqlssh = require('mysql-ssh');
const XMLHttpRequest = require('xhr2');

module.exports = {
    executeQuery: async (query, connection, db, mute = false) => {

        if (connection.type === 'MYSQL') {
            return await executeMySql(query, connection, mute);
        } else if (connection.type === 'POSTGRESQL') {
            return await executePost(query, connection);
        } else if (connection.type === 'ORACLE') { 
            return await executeOracle(query, connection, mute);
        } else if (connection.type === 'MSSQL') { 

        } else if (connection.type === 'CSV') {
            return await executeCSV(query, connection);
        } else if (connection.type === 'JSON') {
            return await executeJSON(query, connection);
        }
    },        
    getConnection: async (connectionId, db) => {
        return await db.Connection.findOne({
            where: {
                id: connectionId
            }
        })
    }
};

async function executeJSON(query, connection) {
    // rivedere query per farle nested nel caso di connessioni json

    // esempio:
    // return response.send(await queryEngine.executeQuery('title where id = 130', {server:'https://safeitaly.org/portale/php/common.php?action=externReadMarkers&id=*&town=1', username: '', type: 'JSON'}));

    query = query.replace(/select|from\s+(.*?)/g, '');
    query = query.replace(/ or /g, ' || ');
    query = query.replace(/ and /g, '&&');
    const results = await (new Promise((resolve, err) => {
        var request = new XMLHttpRequest();
        request.open('GET',connection.server);
        request.setRequestHeader('Authorization', 'Bearer ' + connection.username);
        request.onreadystatechange = () => {
            if (request.readyState === 4) {
                try { 
                    const data = request.response;
                    console.log(data);
                    let json;
                    if (typeof data === 'string' || data instanceof string) {
                        json = JSON.parse(data);
                    } else {
                        json = data;
                    }

                    resolve(jsonSql(json, query));
                } catch (e) {
                    resolve([]);
                }
            }
          }
        request.send();
    }));
    return results;
}

async function executeCSV(query, connection) {
    const name = new Date().now();
    await exec(`wget --no-check-certificate '${connection.server}' -O /tmp/${name}.csv`);
    const results = await exec(`csvsql --query '${query.replace('\'', '\"')}' /tmp/${name}.csv | csvjson`);
    await exec(`rm /tmp/${name}.csv`);
    try {
        return JSON.parse(results) || [];
    } catch (e) {
        console.log(e);
        return [];
    }
}

async function executePost(query, connection) {
    const client = new pg.Client({
        user: connection.username,
        host: connection.server,
        database: connection.database,
        password: connection.password,
        port: connection.port,
    });
    client.connect();
    const results = await client.query(query);
    client.end();
    return results;
      
}

async function executeMySql(query, connection, mute) {
    const dbServer = {
        host: connection.server,
        port: connection.port,
        user: connection.username,
        password: connection.password,
        database: connection.database
    }
    if (connection.overssh) {

        const tunnelConfig = {
            host: connection.sshserver,
            port: 22,
            username: connection.sshuser,
            password: connection.sshpassword
        }
        const rows = new Promise((resolve, error) => {
            try {
                mysqlssh.connect(
                    {
                        host: connection.sshserver,
                        user: connection.sshuser,
                        password: connection.sshpassword
                    },
                    {
                        host: connection.server,
                        port: connection.port,
                        user: connection.username,
                        password: connection.password,
                        database: connection.database
                    }
                )
                .then(client => {
                    try {
                        client.query(query, function (err, results, fields) {
                            if (!err) {
                                mysqlssh.close();
                                resolve(results);
                            } else {
                                if (!mute)
                                    console.error(err);
                                resolve(null);
                            }
                        });
                    } catch (e) {
                        console.log(e);
                        if (!mute) {
                            throw e;
                        }
                    }
                });
            } catch (e) {
                if (!mute) {
                    throw e;
                }
            }
        });
        return await rows;
    } else {
        const rows = new Promise((res, err) => {
            var connection = mysql.createConnection(dbServer);
    
            connection.connect();

            try {
                connection.query(query, function (error, results, fields) {
                    if (error) throw error;
                    res(results);
                });
            } catch (e) {
                if (!mute) {
                    throw e;
                }
            } finally {
                connection.end();
            }
        });
        return await rows;
    }
}

async function executeOracle(query, connection, mute) {
    let oracleConnection;
    try {
        if (!oracleConnection) {
            oracleConnection = await oracledb.getConnection({
                user: connection.username,
                password: connection.password,
                connectionString: `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${connection.server})(PORT=${connection.port}))(CONNECT_DATA=(SERVER=DEDICATED)(SERVICE_NAME=${connection.database})))` //`${connection.server}/${connection.database}` 
            });
        }else {
            console.log("già creato");
        }
        if (oracleConnection) {
            console.log("Successfully connected to Oracle Database");
        }

        let result = await oracleConnection.execute(query, [], { resultSet: true, outFormat: oracledb.OUT_FORMAT_OBJECT });

        const rs = result.resultSet;
        
        let row;
        let rows = [];
    
        while ((row = await rs.getRow())) {
            rows.push(row);
        }

        await rs.close();
        return rows;
    
    } catch (err) {
        if (!mute) {
            console.error(err);
        }
    } finally {
        if (oracleConnection) {
            try {
            await oracleConnection.close();
            } catch (err) {
            console.error(err);
            }
        }
    }
}