const md5 = require("md5");

module.exports = (app, authenticateJWT, dbMeta) => {
    app.get('/users', async (request, response) => {
        authenticateJWT(request, response);
        response.send(await dbMeta.User.findAll());
    });

    app.get('/users/:id', async (request, response) => {
        authenticateJWT(request, response);
        const user = await dbMeta.User.findOne({
            where: {
                id: request.params.id
            }
        });
        delete user.password;
        response.send(user);
    });

    app.post('/password/:id', async (request, response) => {
        authenticateJWT(request, response);
        const user = await dbMeta.User.findOne({
            where: {
                id: request.params.id
            }
        });
        if (user.password === md5(request.body.oldPassword)) {
            await dbMeta.User.update({ password: m5d(request.body.newPassword) }, {
                where: {
                  id: request.params.id
                }
            });
            response.status(200);
        } else {
            response.status(400);
        }
    });
}