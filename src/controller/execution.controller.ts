import { Request, Response } from "express";

import fs from 'fs';
import { createDashboard, diving, execute, insertExecute, pptx, queryExecution } from "../service/execution.service";

export async function executionHandler(req: Request, res: Response, next: any) {
    try {
        if (req.body.insert) {
            const dbs = await insertExecute(+req.params.id, req.body.message, req.params.session, next);
            return res.send(dbs);
        } else {
            const dbs = await execute(+req.params.id, req.body.message, req.params.session, next, req.body.step || 0);
            return res.send(dbs);
        }
    } catch (e) {
        next(e);
    }
}

export async function divingHandler(req: Request, res: Response, next: any) {
    try {
        const dbs = await diving(+req.params.id, req.body, req.params.session);
        return res.send(dbs);
        
    } catch (e) {
        next(e);
    }
}

export async function createDashboardHandler(req: Request, res: Response, next: any, dashboardProcess: any) {
    try {
        console.log(req.body.message);
        dashboardProcess.stdin.write(req.body.message + '\n');
        dashboardProcess.stdout.on('data', async (data: any) => {
            try {
                if (res?.headersSent) {
                    return;
                }
                const NLU = JSON.parse(data);
                if (NLU.intent?.name === 'add') {
                    res.send({
                        intent: NLU.intent?.name,
                        size: NLU.entities[0]?.value
                    });
                } else if (NLU.intent?.name === 'modify') {
                    res.send({
                        intent: NLU.intent?.name,
                        action: NLU.entities?.find((e: any) => e.entity === 'action')?.value,
                        pos: NLU.entities?.find((e: any) => e.entity === 'CARDINAL')?.value,
                    });
                } else if (NLU.intent?.name === 'delete') {
                    res.send({
                        intent: NLU.intent?.name,
                        pos: NLU.entities?.find((e: any) => e.entity === 'CARDINAL')?.value,
                    });
                } else if (NLU.intent?.name === 'create') {
                    const obj = NLU.entities?.find((e: any) => e.entity === 'obj')?.value;
                    if (obj && !req.body.chat) {
                        const queries = await createDashboard(+req.params.id, obj);
                        res.send({
                            intent: NLU.intent?.name,
                            queries
                        });
                    } else {
                        res.send({
                            intent: 'fallback'
                        });
                    }
                } else if (NLU.intent?.name === 'presentation') {
                    res.send({
                        intent: 'presentation'
                    })
                } else if (NLU.intent?.name === 'schema') {
                    if ((req.body.chat && NLU.intent?.confidence > 0.95) || !req.body.chat) {
                        console.log(NLU?.intent?.confidence)
                        res.send({
                            intent: 'schema'
                        });
                    } else {
                        res.send({
                            intent: 'fallback'
                        });
                    }
                }
                dashboardProcess.stdout.removeListener('data');
            } catch (e) {
                next(e);
            }
        });
        
        
    } catch(e) {
        next(e);
    }
}

export async function pptxHandler(req: Request, res: Response, next: any) {
    try {
        const filePath = __dirname + '/../../' + await pptx(+req.params.id, req.body.queries, req.body.titles);

        if (filePath) {
            fs.exists(filePath, function (exists) {
                if (exists) {
                    var stat = fs.statSync(filePath)

                    res.contentType("application/vnd.openxmlformats-officedocument.presentationml.presentation");
                    var file = fs.readFileSync(filePath);

                    res.setHeader('Content-Length', stat.size);
                    res.setHeader('Content-Type', "application/vnd.openxmlformats-officedocument.presentationml.presentation");
                    res.setHeader('Content-Disposition', 'attachment; filename=template.pptx');
                    res.write(file, 'binary');
                    res.end();
                    res.download(filePath);
                    return;
                }
                res.writeHead(400, { "Content-Type": "text/plain" });
                res.end("ERROR File does not exist");
            });
        } else {
            res.status(204)
        }
        
    } catch (e) {
        next(e);
    }
}

export async function queryExecutionHandler(req: Request, res: Response, next: any) {
    try {
        const dbs = await queryExecution(+req.params.id, req.body.query, req.params.session, next);
        return res.send(dbs);
        
    } catch (e) {
        next(e);
    }
}