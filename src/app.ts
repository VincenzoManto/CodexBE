import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
dotenv.config();
import config from 'config';
import responseTime from 'response-time';
import logger from './utils/logger';
import routes from './routes';
import cors from 'cors';
import helmet from 'helmet';
import { restResponseTimeHistogram, startMetricsServer } from './utils/metrics';
import swaggerDocs from './utils/swagger';

const port = +(process.env.CODEX_BE_PORT || 3000);

const app = express();

app.use(express.json());

app.use(express.json());
app.use(helmet());
app.use(cors());

const errorHandler = (error: any, request: any, response: any, next: any) => {
  response.sendStatus(500).send(error);
}


app.use(errorHandler)

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

app.listen(port, async () => {
  logger.info(`App is running at http://localhost:${port}`);

  routes(app);

  startMetricsServer();

  swaggerDocs(app, port);
});
