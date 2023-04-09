const Sequelize = require('sequelize');
require('dotenv').config()
class DbMeta {
    sequelize: any;
    Db: any;
    Connection: any;
    Table: any;
    Columns: any;
    Log: any;
    private static _instance: DbMeta;
    private constructor() {
        console.log('Creating meta db connection');
        const sequelize = new Sequelize(process.env.CODEX_DB_NAME || 'codex',
                                        process.env.CODEX_DB_USER || 'root',
                                        process.env.DB_PASCODEX_DB_PASSWORD || '1234',
                                        {
                                            host: process.env.CODEX_DB_HOST || 'localhost',
                                            dialect: 'mysql'
                                        });
        
        
        this.Log = sequelize.define('log', {
            id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true
            },
            prompt: {
                type: Sequelize.STRING,
                allowNull: false
            },
            query: {
                type: Sequelize.STRING,
                allowNull: false
            },
            db: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            session: {
                type: Sequelize.STRING,
                allowNull: false
            }
        }, { timestamps: false, freezeTableName: true});
        
        this.Table = sequelize.define('table', {
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
            fullname: {
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
        
        
        this.Columns = sequelize.define('columns', {
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
            table: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            description: {
                type: Sequelize.STRING,
                allowNull: true
            }
        }, { timestamps: false, freezeTableName: true});
        
        this.Db = sequelize.define('db', {
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
        
        
        this.Connection = sequelize.define('connection', {
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
    }

    static getInstance() {
        if (this._instance) {
            return this._instance;
        }

        this._instance = new DbMeta();
        return this._instance;
    }
}

export default DbMeta;
