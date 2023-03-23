import { Request, Response } from "express";

import fs from 'fs';
import { createDashboard, diving, execute, pptx } from "../service/execution.service";

export async function executionHandler(req: Request, res: Response, next: any) {
    try {
        const dbs = await execute(+req.params.id, req.body.message, req.params.session, next, req.body.step || 0);
        return res.send(dbs);
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
                    if (obj) {
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