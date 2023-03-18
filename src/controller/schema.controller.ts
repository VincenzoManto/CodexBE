import { Request, Response } from "express";
import { getAllDbs, getSchema, setSchema, tagging } from "../service/schema.service";


export async function getDbs(req: Request, res: Response, next: any) {
    try {
        const dbs = await getAllDbs();
    
        return res.send(dbs);
    } catch (e) {
        next(e);
    }
  }

export async function getSchemaHandler(req: Request, res: Response, next: any) {
    try {
        const dbs = await getSchema(+req.params.id, req.params.seek || '');

        return res.send(dbs);
    } catch (e) {
        next(e);
    }
}

export async function setSchemaHandler(req: Request, res: Response, next: any) {
    try {
        const dbs = await setSchema(req.body.tables);
        
        return res.send(dbs);
    } catch (e) {
        next(e);
    }
}

export async function taggingHandler(req: Request, res: Response, next: any) {
    try {
        const dbs = await tagging(+req.params.id);
        
        return res.send(dbs);
    } catch (e) {
        next(e);
    }
}
  