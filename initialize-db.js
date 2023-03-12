const mysql = require('mysql2/promise');
const GLOBAL = require('./config.ts');
const fs = require('fs/promises');
const path = require('path');



module.exports = (app, authenticateJWT) => {
    app.get('/init/:secret', async (request, response) => {
        if (request.params.secrect === 'NONLOSO') {
            const filePath = path.join(__dirname, 'dump.sql');

            const sql = await fs.readFile(filePath);
            await mysql.createConnection({
                user     : GLOBAL.MySQLUser,
                password : GLOBAL.MySQLPassword
            }).then((connection) => {
                try {
                    connection.query(sql);
                    response.status(200);
                } catch (e) {
                    response.status(500).send(e.message);
                } finally {
                    connection.close();
                }
            });
        } else {
            response.status(401);
        }
    });
}