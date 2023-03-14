import { Request, Response } from "express";
import { getAllDbs, getSchema, setSchema, tagging } from "../service/schema.service";


export async function getDbs(req: Request, res: Response) {
    const dbs = await getAllDbs();
  
    return res.send(dbs);
  }

export async function getSchemaHandler(req: Request, res: Response) {

const dbs = await getSchema(+req.params.id, req.params.seek);

return res.send(dbs);
}

export async function setSchemaHandler(req: Request, res: Response) {

    const dbs = await setSchema(req.body.tables);
    
    return res.send(dbs);
}

export async function taggingHandler(req: Request, res: Response) {

    const dbs = await tagging(+req.params.id);
    
    return res.send(dbs);
}
  