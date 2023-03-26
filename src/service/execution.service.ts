import * as ChildProcess from 'child_process';
import { Op, Sequelize } from 'sequelize';
import DbMeta from '../utils/database-metadata';
import fs from 'fs';


export async function execute(id: number, message: string, session: string, next: any, step: number = 0) {
    const pythonProcess = ChildProcess.spawnSync('python',["ai_modules/data_visualization.py", session, message]);
    const errorText = pythonProcess.stderr.toString().trim();
    if (errorText) {
        console.log("No DV");
        return pruning(id, message, session, step, next);
    } else {
        const dataVis = pythonProcess.stdout.toString().trim(); 
        console.log(dataVis);
        if (!dataVis) {
            return pruning(id, message, session, step, next);
        } else {
            const result = {
                chart: dataVis
            };
            return result;
        }
    }
};

export async function queryExecution(id: number, query: string, session: string, next: any) {
    console.log("Start pruning");
    const pythonProcess = ChildProcess.spawnSync('python',["ai_modules/execution.py", id.toString(), query, session]);
    const errorText = pythonProcess.stderr.toString().trim();
    if (errorText) {
        console.log(errorText);
        throw new Error('Error tagging schema');
    } else {
        const data = pythonProcess.stdout.toString().trim(); 
        const jsonData = JSON.parse(data);
        if (jsonData.results?.length) {
            const pythonProcess = ChildProcess.spawnSync('python',["ai_modules/data_summarization.py", session, JSON.stringify(jsonData.keywords || [])]);

            let summaryResults: any;
        
            const summarizationErrorText = pythonProcess.stderr?.toString().trim();
            if (summarizationErrorText) {
                console.log(summarizationErrorText)
            } else {
                summaryResults = JSON.parse(pythonProcess.stdout.toString().trim());
                jsonData.summarization = summaryResults.text;
                jsonData.pretext = summaryResults.pretext;
                summaryResults.unrelevant = summaryResults.unrelevant || [];
                jsonData.results.forEach((e: any) => {
                    for (const unrelevant of summaryResults.unrelevant) {
                        delete e[unrelevant];
                    }
                });
            }
            const pythonProcessVis = ChildProcess.spawnSync('python',["ai_modules/data_visualization.py", session, "Show me a bar chart"]);
            if (!pythonProcessVis.stderr.toString().trim()) {
                jsonData.chart = pythonProcessVis.stdout.toString().trim();
            } else {
                jsonData.chart = summaryResults?.chart;
            }
        }
        DbMeta.getInstance().Log.create(
            {
                prompt: '%%AUTO QUERY%%',
                query: query || '',
                db: id,
                session: session
            }
        ).catch((err: any) => next(err));
        return jsonData;
    }
};

export async function diving(id: number, body: any, session: string) {
    const pythonProcess = ChildProcess.spawnSync('python',["ai_modules/deep_diving.py", id.toString(), session, JSON.stringify(body)]);
    const errorText = pythonProcess.stderr.toString().trim();
    if (errorText) {
        console.log("error", errorText);
        throw new Error('Error on diving');
    } else {
        const data: any = JSON.parse(pythonProcess.stdout.toString().trim()); 
        const pythonProcessSum = ChildProcess.spawnSync('python',["ai_modules/data_summarization.py", session, JSON.stringify([body.to_table] || [])]);

    
        const summarizationErrorText = pythonProcessSum.stderr?.toString().trim();
        if (summarizationErrorText) {
            console.log(summarizationErrorText)
        } else {
            const summaryResults = JSON.parse(pythonProcessSum.stdout.toString().trim());
            data.summarization = summaryResults.text;
            data.pretext = summaryResults.pretext;
            data.unrelevant = summaryResults.unrelevant || [];
            data.results.forEach((e: any) => {
                for (const unrelevant of data.unrelevant) {
                    delete e[unrelevant];
                }
            });
        }
        DbMeta.getInstance().Log.create(
            {
                prompt: '%%NAVIGATE%%',
                query: data.query || '',
                db: id,
                session: session
            }
        );
        return data;
    }
    
};

function pruning (id: number, message: string, session: string, step: number = 0, next: any) {
    console.log("Start pruning");
    const pythonProcess = ChildProcess.spawnSync('python',["ai_modules/pruning.py", id.toString(), message, session, step.toString()]);
    const errorText = pythonProcess.stderr.toString().trim();
    if (errorText) {
        console.log(errorText);
        throw new Error('Error tagging schema');
    } else {
        const data = pythonProcess.stdout.toString().trim(); 
        const jsonData = JSON.parse(data);
        if (jsonData.results?.length) {
            const pythonProcess = ChildProcess.spawnSync('python',["ai_modules/data_summarization.py", session, JSON.stringify(jsonData.keywords || [])]);

            let summaryResults: any;
        
            const summarizationErrorText = pythonProcess.stderr?.toString().trim();
            if (summarizationErrorText) {
                console.log(summarizationErrorText)
            } else {
                summaryResults = JSON.parse(pythonProcess.stdout.toString().trim());
                jsonData.summarization = summaryResults.text;
                jsonData.pretext = summaryResults.pretext;
                summaryResults.unrelevant = summaryResults.unrelevant || [];
                jsonData.results.forEach((e: any) => {
                    for (const unrelevant of summaryResults.unrelevant) {
                        delete e[unrelevant];
                    }
                });
            }
            const pythonProcessVis = ChildProcess.spawnSync('python',["ai_modules/data_visualization.py", session, "Show me a bar chart"]);
            if (!pythonProcessVis.stderr.toString().trim()) {
                jsonData.chart = pythonProcessVis.stdout.toString().trim();
            } else {
                jsonData.chart = summaryResults?.chart;
            }
        }
        DbMeta.getInstance().Log.create(
            {
                prompt: message,
                query: jsonData.query || '',
                db: id,
                session: session
            }
        ).catch((err: any) => next(err));
        return jsonData;
    }
}

export async function createDashboard(db: number, obj: string) {
    const pythonProcess = ChildProcess.spawnSync('python',["ai_modules/dashboard_pruning.py", db.toString(), obj]);
    const errorText = pythonProcess.stderr.toString().trim();
    if (errorText) {
        console.log("No DV");
        return null;
    } else {
        return JSON.parse(pythonProcess.stdout.toString().trim()); 
    }
    /* if (obj.charAt(obj.length - 1) === 's') {
        obj = obj.substring(0, obj.length - 1);
    }
    const queries = await DbMeta.getInstance().Log.findAll({
        order: [
            ['id', 'desc']
        ],        
        limit: 4,
        where: {
            db: db,
            prompt: {
                [Op.like]: '%' + obj + '%'
            }
        },
        attributes: [Sequelize.fn('DISTINCT', Sequelize.col('prompt')) ,'prompt'],
    });
    console.log(queries)
    return queries;*/
}

export async function pptx(id: number, queries: [], titles: []) {
    const pythonProcess = ChildProcess.spawnSync('python',["ai_modules/data_presentation.py", id.toString(), JSON.stringify(queries), JSON.stringify(titles)]);
    const errorText = pythonProcess.stderr.toString().trim();
    if (errorText) {
        console.log(errorText);
        return null;
    } else {
        return 'temp/' + pythonProcess.stdout.toString().trim(); 
    }
};