import * as ChildProcess from 'child_process';
import _ from 'lodash';
import dbMeta from './../utils/database-metadata';


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
        return JSON.parse(pythonProcess.stdout.toString().trim())
    }
};

export async function getAllDbs() {
    return await dbMeta.Db.findAll();
};

export async function setSchema(tables: Array<any>) {
    try {
        const toInsert = _.cloneDeep(tables.filter(e => e.id === 0 && e.name));
        toInsert.forEach(e => {delete e.id; delete e.columns});
        if (toInsert?.length) {
            const rows = await dbMeta.Table.bulkCreate(
                toInsert,  {returning: true}
            );
            for (const row of rows) {
                const columns = tables.find(e => e.name === row.name)?.columns;
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
        const toUpdate = tables.filter(e => e.id);
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

        return true;
    } catch (e) {
        console.error(e);
        throw new Error('Error updating schema');
    }
}