import { Request, Response } from "express";

import { diving, execute } from "../service/execution.service";

export async function executionHandler(req: Request, res: Response, next: any) {
    try {
        const dbs = await execute(+req.params.id, req.body.message, req.params.session, req.body.step || 0);
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