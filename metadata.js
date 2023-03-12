const joi = require('joi');
const queryEngine = require ('./query-engine.js')
const fs = require('fs/promises');
const _ = require('lodash');
const { exec } = require("child_process");
const { table } = require('console');


module.exports = (app, authenticateJWT, dbMeta) => {

    app.get('/databases/:connid/tables', async (request, response) => {
        authenticateJWT(request, response);
        const connection = await queryEngine.getConnection(request.params.connid, dbMeta);
        if (!connection) {
            return response.status(400).send('Connection not found');
        }
        const tables = await dbMeta.Table.findAll({
            where: {
                connectionId: connection.id
            }
        });
        let queryForTables = ''; 
        switch (connection.type) {
            case 'POSTGRESQL':
                queryForTables = `SELECT table_name as TABLE_NAME FROM information_schema.tables where table_schema = '${connection.database}'`;
                break;
            case 'MYSQL':
                queryForTables = `SELECT table_name as TABLE_NAME FROM information_schema.tables where table_schema = '${connection.database}'`;
                break;
            case 'MSSQL':
                queryForTables = 'SELECT TABLE_NAME FROM  INFORMATION_SCHEMA.TABLES';
                break;
            case 'ORACLE':
                queryForTables = 'select TABLE_NAME from user_tables';
                break;
            case 'CSV':
                return [{TABLE_NAME: 'root'}];
            case 'JSON':
                return [{TABLE_NAME: 'root'}];
        };
        const dbTables = await queryEngine.executeQuery(queryForTables, connection, dbMeta);
        for (const table of dbTables) {
            const item = tables.find(e => e.name === table['TABLE_NAME']);
            if (!item) {
                const newTable = {
                    id: 0,
                    name: table['TABLE_NAME'],
                    connectionId: connection.id,
                    tags: [],
                    columnBlocks: []
                };
                tables.push(newTable);
            }
        }
        return response.send(tables);
    });

    app.post('/databases/:connid/tables', async (request, response) => {
        authenticateJWT(request, response);
        const table = request.body;
        try {
            await dbMeta.Table.create({
                name: table.name,
                connectionId: request.params.connid,
                tags: [],
                columnBlocks: []
            });
            return response.status(200);
        } catch (e) {
            return response.status(500);
        }
    });

    app.get('/databases/:connid/tables/:table/columns', async (request, response) => {
        authenticateJWT(request, response);
        console.log(request.params);
        const connection = await queryEngine.getConnection(request.params.connid, dbMeta);
        if (!connection) {
            return response.status(400).send('Connection not found');
        }
        const columns = await dbMeta.Column.findAll({
            where: {
                table: request.params.table
            }, 
            include: [{
                model: dbMeta.Table,
                as: 'COLUMNS',
                where: {connectionId: connection.id}
            }]
        });
        let queryForColumns = ''; 
        switch (connection.type) {
            case 'MYSQL':
                queryForColumns = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='${connection.database}' AND TABLE_NAME='${table}'`;
                break;
            case 'MSSQL':
                queryForColumns = `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE    TABLE_NAME = '${table}'`;
                break;
            case 'ORACLE':
                queryForColumns = `SELECT column_name FROM USER_TAB_COLUMNS  WHERE table_name = '${table}'`;
                break;
        };
        const dbColumns = await queryEngine.executeQuery(queryForColumns, connection, db);
        for (const column of dbColumns) {
            const item = column.find(e => e.name === column['COLUMN_NAME']);
            if (!item) {
                const newColumn = {
                    id: 0,
                    name: column['COLUMN_NAME'],
                    connectionId: connection.id,
                    tags: [],
                    unit: []
                };
                columns.push(newColumn);
            }
        }
        return response.send(columns);
    });

    app.get('/databases/:connid/tables/:table', async (request, response) => {
        authenticateJWT(request, response);
        response.send(await dbMeta.Table.findOne({
            where: {
                table: request.params.table,
                connectionId: request.params.connid
            }
        }));
    });

    app.get('/connections', async (request, response) => {
        authenticateJWT(request, response);
        response.send(await dbMeta.Connection.findAll());
    });

    app.get('/connections/:connid', async (request, response) => {
        authenticateJWT(request, response);
        response.send(await dbMeta.Connection.findOne({
            where: {
                id: request.params.connid
            }
        }));
    });

    app.get('/databases/:connid/tables/:table/conditions', async (request, response) => {
        authenticateJWT(request, response);
        response.send(await dbMeta.Condition.findAll({
            where: {
                table: request.params.id
            }
        }));
    });

    app.post('/databases/:connid/tables/:table/conditions', async (request, response) => {
        authenticateJWT(request, response);
        try {
            const conditions = request.body;
            const model2upd = conditions.filter(e => e.id > 0);
            const model2ins = conditions.filter(e => e.id === 0).map(e => {
                delete e.id;
                return e;
            });
            await dbMeta.Condition.bulkCreate(model2ins);
            await dbMeta.Condition.bulkCreate(model2upd, {
                updateOnDuplicate: ['id'],
            });
            const allConditions = await dbMeta.Condition.findAll({});
            const schedules = _.uniq(allConditions.map(e => e.time));
            let crontab;
            exec('crontab -l',async (error, stdout, stderr) => {
                crontab = stdout;
                if (crontab?.toString().trim() !== '') {
                    try {
                        let newCrontab = '###INSIGHTER###\n';
                        for (const schedule of schedules) {
                            const cron = `${schedule} php /var/www/html/insighter/api/v2/bot/check.php '${schedule}'\n`;
                            newCrontab += cron;
                        }
                        newCrontab += '###-INSIGHTER-###';
                        crontab = crontab.replace(/###INSIGHTER###(?:(.|\n)*?)###-INSIGHTER-###/m, newCrontab);
                        crontab = crontab.replace(/\n\n/, '\n');
                        await fs.writeFile('/tmp/crontab.txt', crontab);
                        //exec('crontab /tmp/crontab.txt');
                        response.send({result: 'success'});
                    } catch (e) {
                        response.status(500);
                    }
                }
            });
            response.status(200);
        } catch (e) {
            response.status(500);
        }
        
    });

    app.post('/databases/:connid/tables/:table/columns', async (request, response) => {
        authenticateJWT(request, response);
        try {
            const columns = request.body;
            const model2upd = columns.filter(e => e.id > 0);
            const model2ins = columns.filter(e => e.id === 0).map(e => {
                delete e.id;
                return e;
            });
            await dbMeta.Column.bulkCreate(model2ins);
            await dbMeta.Column.bulkCreate(model2upd, {
                updateOnDuplicate: ['id'],
            });
            response.status(200);
        } catch (e) {
            response.status(500);
        }
        
    });

};

