const express = require("express");
const cors = require("cors");

const userRoutes = require("./routes/user");
const artworksRoutes = require("./routes/artworks");
const biddingRoutes = require("./routes/bidding");
const paymentsRoutes = require("./routes/payments");
const wishlishtRoutes = require("./routes/wishlisht");
const notificationRoutes = require("./routes/notification");
const walletRoutes = require("./routes/wallet");
const { prisma } = require("./prisma");
const { redis, connectRedis } = require("./redis");

const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/user", userRoutes);
  app.use("/karya-seni", artworksRoutes);
  app.use("/bid", biddingRoutes);
  app.use("/payments", paymentsRoutes);
  app.use("/wishlisht", wishlishtRoutes);
  app.use("/notification", notificationRoutes);
  app.use("/wallet", walletRoutes);

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
