const Sequelize = require('sequelize');
const sequelize = new Sequelize(process.env.DB_SCHEMA || 'codex',
                                process.env.DB_USER || 'root',
                                process.env.DB_PASSWORD || '1234',
                                {
                                    host: 'localhost',
                                    dialect: 'mysql'
                                });




const Table = sequelize.define('table', {
    id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    db: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    description: {
        type: Sequelize.STRING,
        allowNull: false
    }
}, { timestamps: false, freezeTableName: true});

const Db = sequelize.define('db', {
    id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: Sequelize.STRING,
        allowNull: true
    },
    type: {
        type: Sequelize.STRING,
        allowNull: true
    },
    port: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    server: {
        type: Sequelize.STRING,
        allowNull: false
    },
    username: {
        type: Sequelize.STRING,
        allowNull: true
    },
    password: {
        type: Sequelize.STRING,
        allowNull: true
    },
    /*overssh: {
        type: Sequelize.INTEGER,
        allowNull: true
    },
    sshserver: {
        type: Sequelize.STRING,
        allowNull: true
    },
    sshuser: {
        type: Sequelize.STRING,
        allowNull: true
    },
    sshpassword: {
        type: Sequelize.STRING,
        allowNull: true
    },*/
}, { timestamps: false, freezeTableName: true});


const Connection = sequelize.define('connection', {
    id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    },
    from: {
        type: Sequelize.STRING
    },
    to: {
        type: Sequelize.STRING
    },
    db: {
        type: Sequelize.INTEGER
    }
}, { timestamps: false, freezeTableName: true});

const User = sequelize.define('users', {
    id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    },
    username: {
        type: Sequelize.STRING,
        allowNull: false
    },
    password: {
        type: Sequelize.STRING,
        allowNull: false
    },
    type: {
        type: Sequelize.INTEGER,
        allowNull: false
    },
    groupId: {
        type: Sequelize.STRING,
        allowNull: true
    },
    email: {
        type: Sequelize.STRING,
        allowNull: true
    }
}, { timestamps: false});


/* Db.hasOne(Table, {
    foreignKey: 'connectionId',
    as: 'TABLES'
});*/

module.exports = {
    sequelize: sequelize,
    Db: Db,
    Connection: Connection,
    Table: Table
};