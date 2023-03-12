const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const md5 = require('md5')
const Joi = require('joi');
const cors = require('cors');
const dbMeta = require('./database-metadata.ts');
const fs = require('fs');
const childProcess = require("child_process");
const _ = require('lodash');
require('dotenv').config()



app.use(express.json());
app.use(helmet());
app.use(cors());

const accessTokenSecret = 'bGS6lzFqvvSQ8ALbOxatm7/Vk7mLQyzqaS34Q4oR1ew=';

app.post('/login', async (request, response) => {
    const schema = Joi.object({
        username: Joi.string().min(4).required(),
        password: Joi.string().required(),
        force: Joi.boolean()
    });
    const { error } = schema.validate(request.body);
    if (error) 
        return response.status(400).send(error.details[0].message);
    const { username, password, force } = request.body;

    try {
        const user = await dbMeta.User.findOne({
            where: {
                username: username,
                password: md5(Buffer.from(password, 'base64'))
            }
        });
        if (user || force) {
            const date = new Date((new Date()).getTime() + (2 * 60 * 60 * 1000));
            const googleToken = await getGoogleToken();
            const accessToken = jwt.sign({ 
                username: user?.username || username,
                id: user?.id || 0,
                role: user?.role || 0,
                exp: date.getTime(),
                googleToken: googleToken
            }, accessTokenSecret);

            response.json({
                accessToken,
                id: user?.id
            });
        } else {
            response.status(401).send('Username or password incorrect');
        }
    } catch(e) {
        console.log(e);
        response.status(501).send('Connection error');
    }
});

const authenticateJWT = (req, res, next = () => {}) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, accessTokenSecret, (err, info) => {
            if (err) {
                console.log(err);
                res.sendStatus(403);
                throw 'Unauthorized';
            }

            req.info = info;
            next();
        });
    } else {
        res.sendStatus(401);
        throw 'Unauthorized';
    }
};



process.on('uncaughtException', function (err) {
    console.error(err);
    console.log('Node NOT Exiting...');
});

// PORT
const port = process.env.CODEX_BE_PORT || 3000;
app.listen(port, () => {
    console.log('listing on port ' + port);
});


app.get('/schema/:id/:seek', async (request, response) => {
    const spawn = require("child_process").spawn;
    const pythonProcess = spawn('python',["ai_modules/fetch_schema.py", request.params['id'], request.params['seek']]);
    pythonProcess.stdout.on('data', (data) => {
        try {
            response.send(JSON.parse(data));
        } catch (e) {

        }
        
    },(error) => {
        response.status(500).send('Error fetching the schema');
    });
});

app.post('/schema/:id', async (request, response) => {
    try {
        const toInsert = _.cloneDeep(request.body.tables.filter(e => e.id === 0 && e.name));
        toInsert.forEach(e => {delete e.id; delete e.columns});
        if (toInsert?.length) {
            const rows = await dbMeta.Table.bulkCreate(
                toInsert,  {returning: true}
            );
            for (const row of rows) {
                const columns = request.body.tables.find(e => e.name === row.name)?.columns;
                if (columns?.length) {
                    for (const column of columns) {
                        if (column.description) {
                            await dbMeta.Columns.create(
                            {                                    
                                table: row.id,
                                name: column.name,
                                description: column.description
                            });
                        }
                    }
                    
                }
            }
            
        }
        const toUpdate = request.body.tables.filter(e => e.id);
        for (const row of toUpdate) {
            console.log('Update ' + row.id);
            await dbMeta.Table.update(
                {
                    description: row.description
                },
                {
                where: { id: row.id },
                plain: true
                }
            );
            if (row.columns?.length) {
                for (const column of row.columns) {
                    if (column.description) {
                        const [found, created] = await dbMeta.Columns.findOrCreate(
                            {
                                where: {id: column.id},
                                defaults: {
                                    table: row.id,
                                    name: column.name,
                                    description: column.description
                                }
                            });
                        if (!created && found) {
                            found.update({
                                description: column.description
                            })
                        }
                    }
                }
                
            }
        }

        /*if (request.body.fks?.length) {
            await dbMeta.Connection.destroy({
                where: {
                    db: +request.params['id']
                }
            });
            console.log(request.body.fks)
            await dbMeta.Table.bulkCreate(
                request.body.fks
            );
        }*/
        return response.status(200).send();
    } catch (e) {
        console.error(e);
        return response.status(500).send('Error updating schema');
    }

});

app.get('/dbs', async (request, response) => {
    const results = await dbMeta.Db.findAll();
    console.log(results);
    response.send(results);
});

app.get('/schema-tagging/:id', async (request, response) => {
    const spawn = require("child_process").spawn;
    const pythonProcess = spawn('python',["ai_modules/tagging.py", request.params['id']]);
    pythonProcess.stdout.on('data', (data) => {
        response.status(200).send();
    }, (error) => {
        response.status(500).send('Error tagging schema');
    });
});


app.get('/data/:session?', async (request, response) => {
    var data = Math.random() > 0.5 ?
        [
            {
                "state" : "completed",
                "date_entered" : "2023-02-04 17:23:56",
                "template" : "20221208100",
                "id" : 64,
                "name" : "AI_DDT_20221208100_2021",
                "result" : null
            },
            {
                "state" : "notemplate",
                "date_entered" : "2023-01-04 17:23:56",
                "template" : "20221208100",
                "id" : 65,
                "name" : "AI_DDT_20221208100_4633",
                "result" : null
            },
            {
                "state" : "witherror",
                "date_entered" : "2023-02-04 18:06:10",
                "template" : "29489120",
                "id" : 79,
                "name" : "AI_29489120_04022023180610",
                "result" : null
            },
            {
                "state" : "witherror",
                "date_entered" : "2023-02-05 19:31:08",
                "template" : "29489120",
                "id" : 80,
                "name" : "AI_29489120_1675625468158",
                "result" : null
            },
            {
                "state" : "witherror",
                "date_entered" : "2023-02-05 19:32:43",
                "template" : "29489120",
                "id" : 81,
                "name" : "AI_29489120_1675625563781",
                "result" : null
            },
            {
                "state" : "witherror",
                "date_entered" : "2023-02-05 19:33:39",
                "template" : "29489120",
                "id" : 82,
                "name" : "AI_29489120_1675625619215",
                "result" : null
            },
            {
                "state" : "witherror",
                "date_entered" : "2023-02-05 19:34:33",
                "template" : "29489120",
                "id" : 83,
                "name" : "AI_29489120_1675625673162",
                "result" : null
            },
            {
                "state" : "witherror",
                "date_entered" : "2023-02-06 11:05:35",
                "template" : "29489120",
                "id" : 84,
                "name" : "AI_29489120_06022023110535",
                "result" : null
            },
            {
                "state" : "ready",
                "date_entered" : "2023-02-10 11:05:35",
                "template" : "20221212100",
                "id" : 85,
                "name" : "AI_DDT_20221212100_2893",
                "result" : null
            },
            {
                "state" : "completed",
                "date_entered" : "2023-02-13 07:50:44",
                "template" : "11111111111",
                "id" : 86,
                "name" : "AI_DDT_11111111111_1508",
                "result" : null
            },
            {
                "state" : "completed",
                "date_entered" : "2023-02-13 07:50:45",
                "template" : "11111111111",
                "id" : 87,
                "name" : "AI_DDT_11111111111_1676",
                "result" : null
            }
        ] : [
            {"Province": "Quebec", "Party": "NDP", "Age": 22, "Name": "Liu, Laurin", "Gender": "Female"},
            {"Province": "Quebec", "Party": "Bloc Quebecois", "Age": 43, "Name": "Mourani, Maria", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": "", "Name": "Sellah, Djaouida", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 72, "Name": "St-Denis, Lise", "Gender": "Female"},
            {"Province": "British Columbia", "Party": "Liberal", "Age": 71, "Name": "Fry, Hedy", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 70, "Name": "Turmel, Nycole", "Gender": "Female"},
            {"Province": "Ontario", "Party": "Liberal", "Age": 68, "Name": "Sgro, Judy", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 67, "Name": "Raynault, Francine", "Gender": "Female"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 66, "Name": "Davidson, Patricia", "Gender": "Female"},
            {"Province": "Manitoba", "Party": "Conservative", "Age": 65, "Name": "Smith, Joy", "Gender": "Female"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 64, "Name": "Wong, Alice", "Gender": "Female"},
            {"Province": "New Brunswick", "Party": "Conservative", "Age": 63, "Name": "O'Neill Gordon, Tilly", "Gender": "Female"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 63, "Name": "Ablonczy, Diane", "Gender": "Female"},
            {"Province": "Alberta", "Party": "NDP", "Age": 63, "Name": "Duncan, Linda Francis", "Gender": "Female"},
            {"Province": "Ontario", "Party": "Liberal", "Age": 62, "Name": "Bennett, Carolyn", "Gender": "Female"},
            {"Province": "Ontario", "Party": "NDP", "Age": 61, "Name": "Nash, Peggy", "Gender": "Female"},
            {"Province": "Ontario", "Party": "NDP", "Age": 61, "Name": "Mathyssen, Irene", "Gender": "Female"},
            {"Province": "British Columbia", "Party": "NDP", "Age": 60, "Name": "Sims, Jinny Jogindera", "Gender": "Female"},
            {"Province": "Newfoundland and Labrador", "Party": "Liberal", "Age": 60, "Name": "Foote, Judy", "Gender": "Female"},
            {"Province": "British Columbia", "Party": "NDP", "Age": 60, "Name": "Crowder, Jean", "Gender": "Female"},
            {"Province": "British Columbia", "Party": "NDP", "Age": 59, "Name": "Davies, Libby", "Gender": "Female"},
            {"Province": "Saskatchewan", "Party": "Conservative", "Age": 59, "Name": "Yelich, Lynne", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 58, "Name": "Day, Anne-Marie", "Gender": "Female"},
            {"Province": "British Columbia", "Party": "Green", "Age": 58, "Name": "May, Elizabeth", "Gender": "Female"},
            {"Province": "British Columbia", "Party": "Liberal", "Age": 58, "Name": "Murray, Joyce", "Gender": "Female"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 57, "Name": "Findlay, Kerry-Lynne D.", "Gender": "Female"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 57, "Name": "Brown, Lois", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 57, "Name": "Laverdière, Hélène", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 57, "Name": "Boutin-Sweet, Marjolaine", "Gender": "Female"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 56, "Name": "Crockatt, Joan", "Gender": "Female"},
            {"Province": "Ontario", "Party": "NDP", "Age": 55, "Name": "Chow, Olivia", "Gender": "Female"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 55, "Name": "McLeod, Cathy", "Gender": "Female"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 55, "Name": "Finley, Diane", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 54, "Name": "LeBlanc, Hélène", "Gender": "Female"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 54, "Name": "Grewal, Nina", "Gender": "Female"},
            {"Province": "Ontario", "Party": "NDP", "Age": 54, "Name": "Hughes, Carol", "Gender": "Female"},
            {"Province": "Prince Edward Island", "Party": "Conservative", "Age": 53, "Name": "Shea, Gail", "Gender": "Female"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 53, "Name": "Truppe, Susan", "Gender": "Female"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 52, "Name": "Young, Wai", "Gender": "Female"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 52, "Name": "Gallant, Cheryl", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 52, "Name": "Boivin, Françoise", "Gender": "Female"},
            {"Province": "Saskatchewan", "Party": "Conservative", "Age": 51, "Name": "Block, Kelly", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 50, "Name": "Ayala, Paulina", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 50, "Name": "Groguhé, Sadia", "Gender": "Female"},
            {"Province": "Ontario", "Party": "NDP", "Age": 49, "Name": "Charlton, Chris", "Gender": "Female"},
            {"Province": "Manitoba", "Party": "Conservative", "Age": 48, "Name": "Bergen, Candice", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 46, "Name": "Perreault, Manon", "Gender": "Female"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 46, "Name": "James, Roxanne", "Gender": "Female"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 46, "Name": "Ambler, Stella", "Gender": "Female"},
            {"Province": "Ontario", "Party": "Liberal", "Age": 46, "Name": "Duncan, Kirsty", "Gender": "Female"},
            {"Province": "Manitoba", "Party": "Conservative", "Age": 45, "Name": "Glover, Shelly", "Gender": "Female"},
            {"Province": "Territories", "Party": "Conservative", "Age": 45, "Name": "Aglukkaq, Leona", "Gender": "Female"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 44, "Name": "Raitt, Lisa", "Gender": "Female"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 43, "Name": "Ambrose, Rona", "Gender": "Female"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 42, "Name": "Leitch, Kellie", "Gender": "Female"},
            {"Province": "Nova Scotia", "Party": "NDP", "Age": 39, "Name": "Leslie, Megan", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 38, "Name": "Hassainia, Sana", "Gender": "Female"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 38, "Name": "Adams, Eve", "Gender": "Female"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 32, "Name": "Rempel, Michelle", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 32, "Name": "Papillon, Annick", "Gender": "Female"},
            {"Province": "Ontario", "Party": "NDP", "Age": 31, "Name": "Sitsabaiesan, Rathika", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 30, "Name": "Quach, Anne Minh-Thu", "Gender": "Female"},
            {"Province": "Manitoba", "Party": "NDP", "Age": 30, "Name": "Ashton, Niki", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 29, "Name": "Moore, Christine", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 28, "Name": "Morin, Isabelle", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 28, "Name": "Blanchette-Lamothe, Lysane", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 28, "Name": "Brosseau, Ruth Ellen", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 28, "Name": "Latendresse, Alexandrine", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 28, "Name": "Doré Lefebvre, Rosane", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 27, "Name": "Morin, Marie-Claude", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 27, "Name": "Michaud, Élaine", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 24, "Name": "Péclet, Ève", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 23, "Name": "Freeman, Mylène", "Gender": "Female"},
            {"Province": "Quebec", "Party": "NDP", "Age": 22, "Name": "Borg, Charmaine", "Gender": "Female"},
            {"Province": "Manitoba", "Party": "Conservative", "Age": "", "Name": "Bateman, Joyce", "Gender": "Female"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 43, "Name": "Hiebert, Russ", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 59, "Name": "Jacob, Pierre", "Gender": "Male"},
            {"Province": "Saskatchewan", "Party": "Conservative", "Age": 57, "Name": "Vellacott, Maurice", "Gender": "Male"},
            {"Province": "Saskatchewan", "Party": "Conservative", "Age": 75, "Name": "Boughen, Ray", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 73, "Name": "O'Connor, Gordon", "Gender": "Male"},
            {"Province": "Quebec", "Party": "Liberal", "Age": 72, "Name": "Cotler, Irwin", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 72, "Name": "Oliver, Joe", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 71, "Name": "Tilson, David Allan", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 70, "Name": "Fantino, Julian", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 69, "Name": "Kent, Peter", "Gender": "Male"},
            {"Province": "Quebec", "Party": "Bloc Quebecois", "Age": 69, "Name": "Plamondon, Louis", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 69, "Name": "Schellenberger, Gary", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 68, "Name": "Lauzon, Guy", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 68, "Name": "Harris, Richard M.", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 68, "Name": "Goldring, Peter", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "NDP", "Age": 67, "Name": "Atamanenko, Alex", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 67, "Name": "Payne, LaVar", "Gender": "Male"},
            {"Province": "Saskatchewan", "Party": "Conservative", "Age": 67, "Name": "Breitkreuz, Garry W.", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 66, "Name": "Genest, Réjean", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 66, "Name": "MacKenzie, Dave", "Gender": "Male"},
            {"Province": "Ontario", "Party": "NDP", "Age": 66, "Name": "Hyer, Bruce", "Gender": "Male"},
            {"Province": "Prince Edward Island", "Party": "Liberal", "Age": 66, "Name": "MacAulay, Lawrence", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 65, "Name": "Galipeau, Royal", "Gender": "Male"},
            {"Province": "Ontario", "Party": "NDP", "Age": 65, "Name": "Marston, Wayne", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 65, "Name": "Hawn, Laurie", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 65, "Name": "Kramp, Daryl", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 65, "Name": "Shipley, Bev", "Gender": "Male"},
            {"Province": "Nova Scotia", "Party": "Conservative", "Age": 65, "Name": "Kerr, Greg", "Gender": "Male"},
            {"Province": "Ontario", "Party": "NDP", "Age": 65, "Name": "Comartin, Joe", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 64, "Name": "Norlock, Rick", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Liberal", "Age": 64, "Name": "McKay, John", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 64, "Name": "Mayes, Colin", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Liberal", "Age": 64, "Name": "Rae, Bob", "Gender": "Male"},
            {"Province": "Newfoundland and Labrador", "Party": "NDP", "Age": 64, "Name": "Harris, Jack", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 64, "Name": "Duncan, John", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 63, "Name": "Chisu, Corneliu", "Gender": "Male"},
            {"Province": "Quebec", "Party": "Liberal", "Age": 63, "Name": "Garneau, Marc", "Gender": "Male"},
            {"Province": "Prince Edward Island", "Party": "Liberal", "Age": 63, "Name": "Easter, Arnold Wayne", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 63, "Name": "Aspin, Jay", "Gender": "Male"},
            {"Province": "Saskatchewan", "Party": "Liberal", "Age": 63, "Name": "Goodale, Ralph", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 63, "Name": "Albrecht, Harold", "Gender": "Male"},
            {"Province": "Ontario", "Party": "NDP", "Age": 63, "Name": "Gravelle, Claude", "Gender": "Male"},
            {"Province": "Saskatchewan", "Party": "Conservative", "Age": 63, "Name": "Komarnicki, Ed", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 62, "Name": "Flaherty, James Michael (Jim)", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "NDP", "Age": 62, "Name": "Rankin, Murray", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Liberal", "Age": 62, "Name": "McCallum, John", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 62, "Name": "Warawa, Mark", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 62, "Name": "Obhrai, Deepak", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 62, "Name": "Benoit, Leon Earl", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 62, "Name": "Leung, Chungsen", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 61, "Name": "Morin, Marc-André", "Gender": "Male"},
            {"Province": "Manitoba", "Party": "Conservative", "Age": 61, "Name": "Sopuck, Robert", "Gender": "Male"},
            {"Province": "Saskatchewan", "Party": "Conservative", "Age": 61, "Name": "Ritz, Gerry", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "NDP", "Age": 61, "Name": "Garrison, Randall", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 61, "Name": "Lunney, James", "Gender": "Male"},
            {"Province": "Saskatchewan", "Party": "Conservative", "Age": 61, "Name": "Lukiwski, Tom", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 60, "Name": "Carmichael, John", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 60, "Name": "Menzies, Ted", "Gender": "Male"},
            {"Province": "New Brunswick", "Party": "Conservative", "Age": 60, "Name": "Valcourt, Bernard", "Gender": "Male"},
            {"Province": "New Brunswick", "Party": "Conservative", "Age": 60, "Name": "Ashfield, Keith", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 60, "Name": "Nicholson, Rob", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 60, "Name": "Young, Terence H.", "Gender": "Male"},
            {"Province": "Manitoba", "Party": "Conservative", "Age": 60, "Name": "Toews, Vic", "Gender": "Male"},
            {"Province": "Ontario", "Party": "NDP", "Age": 60, "Name": "Sullivan, Mike", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 59, "Name": "Patry, Claude", "Gender": "Male"},
            {"Province": "Nova Scotia", "Party": "Conservative", "Age": 59, "Name": "Keddy, Gerald", "Gender": "Male"},
            {"Province": "Territories", "Party": "NDP", "Age": 59, "Name": "Bevington, Dennis Fraser", "Gender": "Male"},
            {"Province": "Ontario", "Party": "NDP", "Age": 59, "Name": "Allen, Malcolm", "Gender": "Male"},
            {"Province": "Ontario", "Party": "NDP", "Age": 59, "Name": "Rafferty, John", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 59, "Name": "Dreeshen, Earl", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 59, "Name": "Kamp, Randy", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 59, "Name": "Merrifield, Rob", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 58, "Name": "Woodworth, Stephen", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 58, "Name": "McColeman, Phil", "Gender": "Male"},
            {"Province": "Quebec", "Party": "Conservative", "Age": 58, "Name": "Lebel, Denis", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 58, "Name": "Lizon, Wladyslaw", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 58, "Name": "Holder, Ed", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Liberal", "Age": 58, "Name": "Valeriote, Frank", "Gender": "Male"},
            {"Province": "Ontario", "Party": "NDP", "Age": 58, "Name": "Christopherson, David", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 58, "Name": "Mulcair, Thomas J.", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 58, "Name": "Daniel, Joe", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Liberal", "Age": 57, "Name": "Karygiannis, Jim", "Gender": "Male"},
            {"Province": "New Brunswick", "Party": "NDP", "Age": 57, "Name": "Godin, Yvon", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 57, "Name": "Dionne Labelle, Pierre", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 57, "Name": "Preston, Joe", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Liberal", "Age": 57, "Name": "Bélanger, Mauril", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 57, "Name": "Fast, Edward", "Gender": "Male"},
            {"Province": "Manitoba", "Party": "Conservative", "Age": 57, "Name": "Tweed, Mervin C.", "Gender": "Male"},
            {"Province": "Quebec", "Party": "Liberal", "Age": 57, "Name": "Dion, Stéphane", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 57, "Name": "Van Kesteren, Dave", "Gender": "Male"},
            {"Province": "Nova Scotia", "Party": "Liberal", "Age": 57, "Name": "Cuzner, Rodger", "Gender": "Male"},
            {"Province": "Manitoba", "Party": "NDP", "Age": 57, "Name": "Martin, Pat", "Gender": "Male"},
            {"Province": "Nova Scotia", "Party": "NDP", "Age": 56, "Name": "Stoffer, Peter", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 56, "Name": "Miller, Larry", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 56, "Name": "Blanchette, Denis", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 56, "Name": "Nunez-Melo, José", "Gender": "Male"},
            {"Province": "New Brunswick", "Party": "Conservative", "Age": 55, "Name": "Goguen, Robert", "Gender": "Male"},
            {"Province": "Quebec", "Party": "Liberal", "Age": 55, "Name": "Scarpaleggia, Francis", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 55, "Name": "Sweet, David", "Gender": "Male"},
            {"Province": "Saskatchewan", "Party": "Conservative", "Age": 55, "Name": "Anderson, David", "Gender": "Male"},
            {"Province": "Nova Scotia", "Party": "NDP", "Age": 55, "Name": "Chisholm, Robert", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 55, "Name": "Stanton, Bruce", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 54, "Name": "Goodyear, Gary", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 54, "Name": "Weston, John", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 54, "Name": "Dechert, Bob", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 54, "Name": "Shory, Devinder", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 54, "Name": "Pilon, François", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 54, "Name": "Hayes, Bryan", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 54, "Name": "Giguère, Alain", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 54, "Name": "Sorenson, Kevin", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 53, "Name": "Benskin, Tyrone", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 53, "Name": "Menegakis, Costas", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 53, "Name": "Harper, Stephen", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 53, "Name": "Wilks, David", "Gender": "Male"},
            {"Province": "Nova Scotia", "Party": "Liberal", "Age": 53, "Name": "Regan, Geoff", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Liberal", "Age": 52, "Name": "McGuinty, David", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 52, "Name": "Gosal, Bal", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 52, "Name": "Aubin, Robert", "Gender": "Male"},
            {"Province": "Nova Scotia", "Party": "Liberal", "Age": 52, "Name": "Eyking, Mark", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 52, "Name": "Brown, Gordon", "Gender": "Male"},
            {"Province": "New Brunswick", "Party": "Conservative", "Age": 52, "Name": "Allen, Mike", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 51, "Name": "Clement, Tony", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 51, "Name": "Cannan, Ronald", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 51, "Name": "Rousseau, Jean", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 51, "Name": "Opitz, Ted", "Gender": "Male"},
            {"Province": "Manitoba", "Party": "Conservative", "Age": 50, "Name": "Toet, Lawrence", "Gender": "Male"},
            {"Province": "Ontario", "Party": "NDP", "Age": 50, "Name": "Cash, Andrew", "Gender": "Male"},
            {"Province": "Manitoba", "Party": "Liberal", "Age": 50, "Name": "Lamoureux, Kevin", "Gender": "Male"},
            {"Province": "Ontario", "Party": "NDP", "Age": 50, "Name": "Scott, Craig", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 50, "Name": "Adler, Mark", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 50, "Name": "Carrie, Colin", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "NDP", "Age": 50, "Name": "Julian, Peter", "Gender": "Male"},
            {"Province": "Quebec", "Party": "Liberal", "Age": 50, "Name": "Pacetti, Massimo", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 50, "Name": "Saganash, Romeo", "Gender": "Male"},
            {"Province": "Ontario", "Party": "NDP", "Age": 50, "Name": "Angus, Charlie", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "NDP", "Age": 49, "Name": "Davies, Don", "Gender": "Male"},
            {"Province": "Quebec", "Party": "Conservative", "Age": 49, "Name": "Bernier, Maxime", "Gender": "Male"},
            {"Province": "Ontario", "Party": "NDP", "Age": 49, "Name": "Dewar, Paul", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 49, "Name": "Jean, Brian", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 49, "Name": "Devolin, Barry", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 49, "Name": "Lemieux, Pierre", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 49, "Name": "Van Loan, Peter", "Gender": "Male"},
            {"Province": "Prince Edward Island", "Party": "Liberal", "Age": 49, "Name": "Casey, Sean", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 49, "Name": "Nantel, Pierre", "Gender": "Male"},
            {"Province": "Quebec", "Party": "Liberal", "Age": 49, "Name": "Coderre, Denis", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 49, "Name": "Wallace, Mike", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 48, "Name": "Braid, Peter", "Gender": "Male"},
            {"Province": "Quebec", "Party": "Conservative", "Age": 48, "Name": "Gourde, Jacques", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 48, "Name": "Reid, Scott", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Liberal", "Age": 48, "Name": "Hsu, Ted", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 48, "Name": "Saxton, Andrew", "Gender": "Male"},
            {"Province": "New Brunswick", "Party": "Conservative", "Age": 48, "Name": "Weston, Rodney", "Gender": "Male"},
            {"Province": "Newfoundland and Labrador", "Party": "Conservative", "Age": 48, "Name": "Penashue, Peter", "Gender": "Male"},
            {"Province": "Quebec", "Party": "Bloc Quebecois", "Age": 48, "Name": "Bellavance, André", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 48, "Name": "Rathgeber, Brent", "Gender": "Male"},
            {"Province": "Ontario", "Party": "NDP", "Age": 48, "Name": "Kellway, Matthew", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 47, "Name": "Toone, Philip", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 47, "Name": "Allison, Dean", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 47, "Name": "Trottier, Bernard", "Gender": "Male"},
            {"Province": "Quebec", "Party": "Conservative", "Age": 47, "Name": "Blaney, Steven", "Gender": "Male"},
            {"Province": "Manitoba", "Party": "Conservative", "Age": 47, "Name": "Bezan, James", "Gender": "Male"},
            {"Province": "Nova Scotia", "Party": "Conservative", "Age": 47, "Name": "MacKay, Peter Gordon", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 46, "Name": "Dykstra, Richard", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "NDP", "Age": 46, "Name": "Sandhu, Jasbir", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "NDP", "Age": 46, "Name": "Donnelly, Fin", "Gender": "Male"},
            {"Province": "Nova Scotia", "Party": "Conservative", "Age": 46, "Name": "Armstrong, Scott", "Gender": "Male"},
            {"Province": "Newfoundland and Labrador", "Party": "Liberal", "Age": 46, "Name": "Byrne, Gerry", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "NDP", "Age": 46, "Name": "Stewart, Kennedy", "Gender": "Male"},
            {"Province": "Newfoundland and Labrador", "Party": "NDP", "Age": 46, "Name": "Cleary, Ryan", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 45, "Name": "Côté, Raymond", "Gender": "Male"},
            {"Province": "Saskatchewan", "Party": "Conservative", "Age": 45, "Name": "Clarke, Rob", "Gender": "Male"},
            {"Province": "Nova Scotia", "Party": "Liberal", "Age": 45, "Name": "Brison, Scott", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 45, "Name": "Butt, Brad", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 45, "Name": "Rickford, Greg", "Gender": "Male"},
            {"Province": "New Brunswick", "Party": "Liberal", "Age": 45, "Name": "LeBlanc, Dominic", "Gender": "Male"},
            {"Province": "Saskatchewan", "Party": "Conservative", "Age": 45, "Name": "Hoback, Randy", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 44, "Name": "Caron, Guy", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 44, "Name": "Brahmi, Tarik", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 44, "Name": "Kenney, Jason", "Gender": "Male"},
            {"Province": "Ontario", "Party": "NDP", "Age": 44, "Name": "Masse, Brian", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 44, "Name": "Alexander, Chris", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 44, "Name": "Zimmer, Bob", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 44, "Name": "Calkins, Blaine", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 43, "Name": "Baird, John", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 43, "Name": "Lake, Mike", "Gender": "Male"},
            {"Province": "Newfoundland and Labrador", "Party": "Liberal", "Age": 43, "Name": "Simms, Scott", "Gender": "Male"},
            {"Province": "Ontario", "Party": "NDP", "Age": 43, "Name": "Thibeault, Glenn", "Gender": "Male"},
            {"Province": "New Brunswick", "Party": "Conservative", "Age": 42, "Name": "Williamson, John", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 42, "Name": "Calandra, Paul", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 42, "Name": "Chicoine, Sylvain", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 42, "Name": "Del Mastro, Dean", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 42, "Name": "Rajotte, James", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 42, "Name": "Seeback, Kyle", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 41, "Name": "Watson, Jeff", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 41, "Name": "Lapointe, François", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 41, "Name": "Nicholls, Jamie", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 41, "Name": "Chong, Michael D.", "Gender": "Male"},
            {"Province": "Quebec", "Party": "Liberal", "Age": 41, "Name": "Trudeau, Justin", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 40, "Name": "Larose, Jean-François", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 40, "Name": "Anders, Rob", "Gender": "Male"},
            {"Province": "Manitoba", "Party": "Conservative", "Age": 40, "Name": "Fletcher, Steven John", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "NDP", "Age": 40, "Name": "Cullen, Nathan", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 39, "Name": "Ravignat, Mathieu", "Gender": "Male"},
            {"Province": "Manitoba", "Party": "Conservative", "Age": 39, "Name": "Bruinooge, Rod", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 39, "Name": "Mai, Hoang", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 39, "Name": "Boulerice, Alexandre", "Gender": "Male"},
            {"Province": "Quebec", "Party": "Bloc Quebecois", "Age": 39, "Name": "Fortin, Jean-François", "Gender": "Male"},
            {"Province": "Territories", "Party": "Conservative", "Age": 38, "Name": "Leef, Ryan", "Gender": "Male"},
            {"Province": "Quebec", "Party": "Conservative", "Age": 38, "Name": "Paradis, Christian", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 38, "Name": "Choquette, François", "Gender": "Male"},
            {"Province": "New Brunswick", "Party": "Conservative", "Age": 38, "Name": "Moore, Rob", "Gender": "Male"},
            {"Province": "Saskatchewan", "Party": "Conservative", "Age": 38, "Name": "Trost, Brad", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 38, "Name": "Gill, Parm", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 38, "Name": "Hillyer, Jim", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 38, "Name": "Richards, Blake", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 38, "Name": "Uppal, Tim", "Gender": "Male"},
            {"Province": "Newfoundland and Labrador", "Party": "Liberal", "Age": 37, "Name": "Andrews, Scott", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 36, "Name": "Moore, James", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 36, "Name": "Lobb, Ben", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 36, "Name": "Albas, Dan", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 34, "Name": "Storseth, Brian", "Gender": "Male"},
            {"Province": "British Columbia", "Party": "Conservative", "Age": 34, "Name": "Strahl, Mark", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 34, "Name": "Brown, Patrick W.", "Gender": "Male"},
            {"Province": "Alberta", "Party": "Conservative", "Age": 34, "Name": "Warkentin, Chris", "Gender": "Male"},
            {"Province": "Saskatchewan", "Party": "Conservative", "Age": 33, "Name": "Scheer, Andrew", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": 33, "Name": "Poilievre, Pierre", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 33, "Name": "Genest-Jourdain, Jonathan", "Gender": "Male"},
            {"Province": "Ontario", "Party": "NDP", "Age": 33, "Name": "Harris, Dan", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 28, "Name": "Tremblay, Jonathan", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 27, "Name": "Morin, Dany", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 24, "Name": "Dubé, Matthew", "Gender": "Male"},
            {"Province": "Quebec", "Party": "NDP", "Age": 21, "Name": "Dusseault, Pierre-Luc", "Gender": "Male"},
            {"Province": "Ontario", "Party": "Conservative", "Age": "", "Name": "O'Toole, Erin", "Gender": "Male"} ];
    const content = JSON.stringify(data);
    fs.writeFile('temp/' + request.params['session'], content, err => {
        if (err) {
            console.error(err);
        }
        // file written successfully
    });
    
    response.send({
        results: data,
        jumps: [{"from": "Province", "to": "Cd_Prov", "to_table": "Provinces", "to_table_alias": "province"}, {"from": "Party", "to": "Cd_Party", "to_table": "Parties", "to_table_alias": "partito"}]}
    );
});

app.post('/execute/:id/:session', async (request, response) => {
    const pythonProcess = childProcess.spawnSync('python',["ai_modules/data_visualization.py", request.params['session'], request.body.message]);
    const errorText = pythonProcess.stderr.toString().trim();
    if (errorText) {
        console.log("error", errorText);
        pruning(request, response);
    } else {
        const dataVis = pythonProcess.stdout.toString().trim(); 
        console.log(dataVis);
        if (!dataVis) {
            pruning(request, response);
        } else {
            const result = {
                chart: dataVis
            };
            response.send(result);
        }
    }
    
});

app.post('/navigate/:id/:session', async (request, response) => {
    const session = request.params['session'];
    /*if (!this.lastQueries[session]) {
        return response.status(400).send();
    }*/
    const pythonProcess = childProcess.spawnSync('python',["ai_modules/deep_diving.py", request.params.id, session, JSON.stringify(request.body)]);
    const errorText = pythonProcess.stderr.toString().trim();
    if (errorText) {
        console.log("error", errorText);
        return response.status(500).send('Error on diving');
    } else {
        const data = pythonProcess.stdout.toString().trim(); 
        response.send(data);
    }
    
});

pruning = (request, response) => {
    console.log("I prune");
    const pythonProcess = childProcess.spawnSync('python',["ai_modules/pruning.py", request.params.id, request.body.message, request.params.session, request.body.step || 0]);
    const errorText = pythonProcess.stderr.toString().trim();
    if (errorText) {
        response.status(500).send('Error tagging schema');
    } else {
        const data = pythonProcess.stdout.toString().trim(); 
        const jsonData = JSON.parse(data);
        if (jsonData.results?.length) {
            const pythonProcess = childProcess.spawnSync('python',["ai_modules/data_summarization.py", request.params.session, request.body.message]);
            if (!pythonProcess.stderr.toString().trim()) {
                jsonData.summarization = pythonProcess.stdout.toString().trim();
            }
            const pythonProcessVis = childProcess.spawnSync('python',["ai_modules/data_visualization.py", request.params.session, "Show me a chart"]);
            if (!pythonProcessVis.stderr.toString().trim()) {
                jsonData.chart = pythonProcessVis.stdout.toString().trim();
            }
        }
        response.status(200).send(jsonData);
    }
}