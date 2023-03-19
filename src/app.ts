import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
dotenv.config();
import * as fs from 'fs';
import responseTime from 'response-time';
import logger from './utils/logger';
import routes from './routes';
import cors from 'cors';
import helmet from 'helmet';
import { restResponseTimeHistogram, startMetricsServer } from './utils/metrics';
import swaggerDocs from './utils/swagger';
import * as ChildProcess from 'child_process';
import path from 'path';
import dbMeta from './utils/database-metadata';
import DbMeta from './utils/database-metadata';

const port = +(process.env.CODEX_BE_PORT || 3000);

const app = express();

app.use(express.json());

app.use(express.json());
app.use(helmet());
app.use(cors());




app.use(
  responseTime((req: Request, res: Response, time: number) => {
    if (req?.route?.path) {
      restResponseTimeHistogram.observe(
        {
          method: req.method,
          route: req.route.path,
          status_code: res.statusCode,
        },
        time * 1000
      );
    }
  })
);

const dashboardProcess = ChildProcess.spawn('python',["ai_modules/dashboard.py"]);
dashboardProcess.stderr.on('data', (data) => {
  console.log(data.toString());
});

fs.readdir('./temp', (err: any, files: any) => {
  if (err) throw err;

  const toDelete = files.filter((e: any, i: number) => i < 10);
  for (const file of toDelete) {
    fs.unlink(path.join('./temp', file), (err: any) => {
      if (err) throw err;
    });
  }
});

DbMeta.getInstance();

app.listen(port, async () => {


  logger.info(`App is running at http://localhost:${port}`);

  routes(app, dashboardProcess);

  startMetricsServer();

  swaggerDocs(app, port);
});