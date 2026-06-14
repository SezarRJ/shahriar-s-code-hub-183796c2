import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SHAHID API Gateway',
      version: '1.0.0',
      description: 'API Gateway for SHAHID construction documentation system',
    },
    servers: [
      {
        url: 'https://shahid-api-gateway.onrender.com',
        description: 'Production Server',
      },
      {
        url: 'http://localhost:3001',
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{
      bearerAuth: [],
    }],
  },
  apis: ['./src/routes/*.ts', './src/index.ts'], 
};

export const specs = swaggerJsdoc(swaggerOptions);
export const swaggerUiMiddleware = swaggerUi.serve;
export const swaggerUiSetup = swaggerUi.setup(specs);
