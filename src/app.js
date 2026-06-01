const express = require("express");
const cors = require("cors");

const userRoutes = require("./routes/user");
const artworksRoutes = require("./routes/artworks");
const biddingRoutes = require("./routes/bidding");
const paymentsRoutes = require("./routes/payments");
const wishlishtRoutes = require("./routes/wishlisht");
const notificationRoutes = require("./routes/notification");
const walletRoutes = require("./routes/wallet");
const certificateRoutes = require("./routes/certificate");
const { prisma } = require("./prisma");
const { redis, connectRedis } = require("./redis");

const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // --- API routes ---
  app.use("/user", userRoutes);
  app.use("/karya-seni", artworksRoutes);
  app.use("/bid", biddingRoutes);
  app.use("/payments", paymentsRoutes);
  app.use("/wishlisht", wishlishtRoutes);
  app.use("/notification", notificationRoutes);
  app.use("/wallet", walletRoutes);
  app.use("/certificate", certificateRoutes);

  // --- Swagger / OpenAPI (generated from JSDoc annotations) ---
  try {
    const swaggerJSDoc = require('swagger-jsdoc');
    const swaggerUi = require('swagger-ui-express');

    // Prefer an explicit CLOUD_RUN_URL (for your Cloud Run deployment),
    // then DEPLOYMENT_URL, then fallback to localhost for local dev.
    const defaultServer = process.env.CLOUD_RUN_URL || process.env.DEPLOYMENT_URL || 'http://localhost:3000';
    const swaggerDefinition = {
      openapi: '3.0.0',
      info: { title: 'TCC Backend API', version: '1.0.0' },
      servers: [{ url: defaultServer }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        },
        schemas: {
          UserRegister: {
            type: 'object',
            properties: {
              username: { type: 'string' },
              email: { type: 'string' },
              password: { type: 'string' }
            }
          },
          Artwork: {
            type: 'object',
            properties: {
              nama_karya: { type: 'string' },
              deskripsi: { type: 'string' },
              katalog: { type: 'string' },
              tags: { type: 'string' },
              min_bid_ammount: { type: 'number' }
            }
          },
          Bid: {
            type: 'object',
            properties: {
              artworks_id: { type: 'string' },
              ammount: { type: 'number' }
            }
          },
          Certificate: {
            type: 'object',
            properties: {
              artworks_id: { type: 'string' },
              congratulation_sentence: { type: 'string' }
            }
          }
        }
      },
    };

    const options = {
      swaggerDefinition,
      // scan route files for JSDoc comments
      apis: [__dirname + '/routes/*.js']
    };

    const swaggerSpec = swaggerJSDoc(options);

    app.use('/openapi.json', (_req, res) => res.json(swaggerSpec));
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  } catch (err) {
    // optional dependency might not be installed during some workflows
    console.warn('swagger-jsdoc not available', err && err.message);
  }

  // Serve OpenAPI spec and Swagger UI
  app.get('/openapi.json', (_req, res) => {
    // send the bundled OpenAPI JSON
    return res.sendFile(require('path').join(__dirname, '..', 'docs', 'openapi.json'));
  });

  app.get('/docs', (_req, res) => {
    return res.sendFile(require('path').join(__dirname, '..', 'docs', 'swagger.html'));
  });

  app.get("/health", async (_req, res) => {
    const checks = {
      prisma: { status: "unknown" },
      redis: { status: "unknown" },
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.prisma.status = "ok";
    } catch (error) {
      checks.prisma.status = "error";
      checks.prisma.error = error.message;
    }

    try {
      await connectRedis();
      await redis.ping();
      checks.redis.status = "ok";
    } catch (error) {
      checks.redis.status = "error";
      checks.redis.error = error.message;
    }

    const isHealthy = checks.prisma.status === "ok" && checks.redis.status === "ok";
    return res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? "ok" : "degraded",
      checks,
      version: "0.3"
    });
  });

  return app;
};

module.exports = { createApp };
