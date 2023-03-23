import { Express, Request, Response } from "express";
import { createDashboardHandler, divingHandler, executionHandler, pptxHandler } from "./controller/execution.controller";
import { getDbs, getSchemaHandler, setSchemaHandler, taggingHandler } from "./controller/schema.controller";
import fs from 'fs';


function routes(app: Express, dashboardProcess: any) {
  /**
   * @openapi
   * /healthcheck:
   *  get:
   *     tags:
   *     - Healthcheck
   *     description: Responds if the app is up and running
   *     responses:
   *       200:
   *         description: App is up and running
   */
  app.get("/healthcheck", (req: Request, res: Response) => {
    console.log('healthcheck')
    res.sendStatus(200)
  });

  /**
   * @openapi
   * /api/dbs:
   *  get:
   *     tags:
   *     - Connections
   *     description: Responds with the list of existing connections
   *     responses:
   *       200:
   *         description: List of available connections (may be empty)
   *       500:
   *         description: Connectivity errors occuring when querying metadata local DB
   */
  app.get("/api/dbs", getDbs);

  /**
   * @openapi
   * /api/schema:
   *  get:
   *     tags:
   *     - Schema
   *     description: Responds with the list of tables with columns and metadata (tags) refered to a connection and a initial letter
   *     parameters:
   *      - name: id
   *        in: path
   *        description: The id of the connection
   *        required: true
   *      - name: seek
   *        in: path
   *        description: The letter needle
   *        required: false
   *     responses:
   *       200:
   *         description: List of available tables (may be empty)
   *       500:
   *         description: Connectivity errors occuring when querying metadata local DB or outgoing data source
   */
  app.get('/api/schema/:id/:seek?', getSchemaHandler);
  
  /**
   * @openapi
   * /api/schema:
   *  post:
   *     tags:
   *     - Schema
   *     description: Insert, update or remove metadata about a datasource
   *     parameters:
   *      - name: id
   *        in: path
   *        description: The id of the connection
   *        required: true
   *     responses:
   *       200:
   *         description: All edits are saved correctly
   *       500:
   *         description: Connectivity errors occuring when querying metadata local DB or outgoing data source
   */
  app.post('/api/schema/:id', setSchemaHandler);

  /**
   * @openapi
   * /api/tagging:
   *  get:
   *     tags:
   *     - Schema
   *     - Tagging
   *     description: Elaborate the tagged encoded model and dictionary of the data source
   *     parameters:
   *      - name: id
   *        in: path
   *        description: The id of the connection
   *        required: true
   *     responses:
   *       200:
   *         description: Correctly encoded
   *       500:
   *         description: Connectivity errors occuring when querying metadata local DB or outgoing data source or when enconding the dictionary
   */
  app.get('/api/tagging/:id', taggingHandler);

   /**
   * @openapi
   * /api/execute:
   *  get:
   *     tags:
   *     - NQL
   *     description: Prune the schema, promptify the request and execute the query based on a user input
   *     parameters:
   *      - name: id
   *        in: path
   *        description: The id of the connection
   *        required: true
   *      - name: session
   *        in: path
   *        description: The id of the session
   *        required: true
   *      - name: message
   *        in: body
   *        description: The user prompt
   *        required: true
   *      - name: step
   *        in: body
   *        schema:
   *          type: integer
   *          minimum: 0
   *          maximum: 3
   *        description: The depth of request
   *        examples: 
   *          zero: 
   *            value: 0
   *            summary: pruning
   *          one:
   *            value: 1
   *            summary: prompting
   *          two:
   *            value: 2
   *            summary: querifing
   *          three:
   *            value: 3
   *            summary: executing
   *        required: false
   *     responses:
   *       200:
   *         description: Correctly executed
   *       500:
   *         description: Connectivity errors occuring when querying metadata local DB or outgoing data source or when executing queries
   */
  app.post('/api/execute/:id/:session', executionHandler);

  /**
   * @openapi
   * /api/navigate:
   *  get:
   *     tags:
   *     - NQL
   *     description: Navigate, given the previous query, to other inquiries
   *     parameters:
   *      - name: id
   *        in: path
   *        description: The id of the connection
   *        required: true
   *      - name: session
   *        in: path
   *        description: The id of the session
   *        required: true
   *     responses:
   *       200:
   *         description: Correctly executed
   *       500:
   *         description: Connectivity errors occuring when querying metadata local DB or outgoing data source or when executing queries
   */
  app.post('/api/navigate/:id/:session', divingHandler);

  app.post('/api/dashboard/:id', async (req, res, next) => createDashboardHandler(req, res, next, dashboardProcess));

  app.post('/api/pptx/:id', pptxHandler);

  app.use( (error: any, request: any, response: any, next: any) => {
    console.error(error);
    response.status(500).send(error);
  })
}

export default routes;
