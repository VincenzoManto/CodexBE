import * as ChildProcess from 'child_process';
import _ from 'lodash';
import DbMeta from '../utils/database-metadata';


export async function getSchema(id: number, seek: string) {
    const pythonProcess = ChildProcess.spawnSync('python',["ai_modules/fetch_schema.py", id.toString(), seek]);
    const errorText = pythonProcess.stderr.toString().trim();
    if (errorText) {
        throw new Error('Error fetching the schema');
    } else {
        return JSON.parse(pythonProcess.stdout.toString().trim())
    }
};

export async function tagging(id: number) {
    const pythonProcess = ChildProcess.spawnSync('python',["ai_modules/tagging.py", id.toString()]);
    const errorText = pythonProcess.stderr.toString().trim();
    if (errorText) {
        throw new Error('Error tagging schema');
    } else {
        return true
    }
};

export async function getAllDbs() {
    return await DbMeta.getInstance().Db.findAll({
        attributes: ['id', 'name']
    });
};

export async function setNotes(notes: string, db: number) {
    await DbMeta.getInstance().Db.update({
        notes
    }, {  where: { id: db }});
}

export async function setSchema(tables: Array<any>) {
    try {
        const toInsert = _.cloneDeep(tables.filter(e => e.id === 0 && e.name));
        toInsert.forEach(e => {delete e.id; delete e.columns});
        if (toInsert?.length) {
            const rows = await DbMeta.getInstance().Table.bulkCreate(
                toInsert,  {returning: true}
            );
            for (const row of rows) {
                const columns = tables.find(e => e.name === row.name)?.columns;
                if (columns?.length) {
                    for (const column of columns) {
                        if (column.description) {
                            await DbMeta.getInstance().Columns.create(
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
        const toUpdate = tables.filter(e => e.id);
        for (const row of toUpdate) {
            console.log('Update ' + row.id);
            await DbMeta.getInstance().Table.update(
                {
                    description: row.description,
                    fullname: row.fullname
                },
                {
                where: { id: row.id },
                plain: true
                }
            );
            if (row.columns?.length) {
                for (const column of row.columns) {
                    if (column.description) {
                        const [found, created] = await DbMeta.getInstance().Columns.findOrCreate(
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

        return true;
    } catch (e) {
        console.error(e);
        throw new Error('Error updating schema');
    }
}