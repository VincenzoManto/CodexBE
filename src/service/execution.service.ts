import * as ChildProcess from 'child_process';

export async function execute(id: number, message: string, session: string, step: number = 0) {
    const pythonProcess = ChildProcess.spawnSync('python',["ai_modules/data_visualization.py", session, message]);
    const errorText = pythonProcess.stderr.toString().trim();
    if (errorText) {
        console.log("error", errorText);
        pruning(id, message, session, step);
    } else {
        const dataVis = pythonProcess.stdout.toString().trim(); 
        console.log(dataVis);
        if (!dataVis) {
            pruning(id, message, session, step);
        } else {
            const result = {
                chart: dataVis
            };
            return result;
        }
    }
};

export async function diving(id: number, body: any, session: string) {
    const pythonProcess = ChildProcess.spawnSync('python',["ai_modules/deep_diving.py", id.toString(), session, JSON.stringify(body)]);
    const errorText = pythonProcess.stderr.toString().trim();
    if (errorText) {
        console.log("error", errorText);
        throw new Error('Error on diving');
    } else {
        const data = pythonProcess.stdout.toString().trim(); 
        return data;
    }
};

function pruning (id: number, message: string, session: string, step: number = 0) {
    console.log("I prune");
    const pythonProcess = ChildProcess.spawnSync('python',["ai_modules/pruning.py", id.toString(), message, session, step.toString()]);
    const errorText = pythonProcess.stderr.toString().trim();
    if (errorText) {
        throw new Error('Error tagging schema');
    } else {
        const data = pythonProcess.stdout.toString().trim(); 
        const jsonData = JSON.parse(data);
        if (jsonData.results?.length) {
            const pythonProcess = ChildProcess.spawnSync('python',["ai_modules/data_summarization.py", session, message]);
            if (!pythonProcess.stderr.toString().trim()) {
                jsonData.summarization = pythonProcess.stdout.toString().trim();
            }
            const pythonProcessVis = ChildProcess.spawnSync('python',["ai_modules/data_visualization.py", session, "Show me a chart"]);
            if (!pythonProcessVis.stderr.toString().trim()) {
                jsonData.chart = pythonProcessVis.stdout.toString().trim();
            }
        }
        return jsonData;
    }
}