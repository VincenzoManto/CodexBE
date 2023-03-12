import swaggerJsdoc from 'swagger-jsdoc';
import {request, response} from 'express';
import swaggerUi from 'swagger-ui-express';
// import log from './logger';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'REST API Docs',
      version: 1,
    },
    components: {
      securitySchemas: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  encoding: 'UTF-8',
  failOnErrors: true,
  verbose: false,
  format: '',
  swaggerDefinition: null,
  apis: ['./src/routes.ts', './src/schema/*.ts'],
};

//{ encoding: string; failOnErrors: boolean; verbose: boolean; format: string; swaggerDefinition: any; definition: any; apis: any[]; }

const swaggerSpec = swaggerJsdoc(options);

function swaggerDocs(app: any, port: number) {
  // Swagger page
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Docs in JSON format
  app.get('/docs.json', (req: request, res: response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // log.info(`Docs available at http://localhost:${port}/docs`);
}

export default swaggerDocs;