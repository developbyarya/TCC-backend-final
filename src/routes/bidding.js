const express = require("express");
const { randomUUID } = require("crypto");
const { prisma } = require("../prisma");
const { requireAuth } = require("../middleware/auth");
const { redis, connectRedis } = require("../redis");

const router = express.Router();

router.post("/new", requireAuth, async (req, res) => {
  const artworksId = req.body.artworks_id;
  const amount = req.body.ammount;

  const previousHighest = await prisma.bid.findFirst({
    where: { artworksId },
    orderBy: { amount: "desc" },
  });

  const bid = await prisma.bid.create({
    data: {
      artworksId,
      amount,
      bidById: req.user.id,
      status: "OPEN",
      timestamp: new Date(),
    },
  });

  const isNewHighest = !previousHighest || amount > previousHighest.amount;
  const shouldNotify =
    isNewHighest && previousHighest && previousHighest.bidById !== req.user.id;

  if (shouldNotify) {
    const notificationId = randomUUID();
    const key = `notificationBid:user:${previousHighest.bidById}:${notificationId}`;
    const message = `Your bid was outbid for artwork ${artworksId}. New highest bid: ${amount}.`;
    const payload = {
      id: notificationId,
      message,
      bidId: bid.id,
      artworksId,
      createdAt: new Date().toISOString(),
    };

    try {
      await connectRedis();
      await redis.set(key, JSON.stringify(payload));
    } catch (err) {
      console.error("Failed to store bid notification", err.message || err);
    }
  }

  return res.status(201).json(bid);
});

router.put("/:id/cancle", requireAuth, async (req, res) => {
  const bid = await prisma.bid.update({
    where: { id: req.params.id },
    data: { status: "FAILED" },
  });

  return res.json(bid);
});

router.get("/:id/detail", requireAuth, async (req, res) => {
  const bid = await prisma.bid.findUnique({ where: { id: req.params.id } });
  if (!bid) {
    return res.status(404).json({ message: "Not found" });
  }
  return res.json(bid);
});

router.get("/low-high", requireAuth, async (_req, res) => {
  const cacheKey = "bid:low-high";

  // Try reading cached value from Redis
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
  } catch (err) {
    // Log and continue to fetch from DB on Redis errors
    console.error("Redis get error", err);
  }

  const [low, high] = await Promise.all([
    prisma.bid.findFirst({ orderBy: { amount: "asc" } }),
    prisma.bid.findFirst({ orderBy: { amount: "desc" } }),
  ]);

  const payload = { low, high };

  // Populate Redis cache (short TTL for freshness)
  try {
    await redis.set(cacheKey, JSON.stringify(payload), { EX: 30 }); // 30 seconds
  } catch (err) {
    console.error("Redis set error", err);
  }

  return res.json(payload);
});

router.get("/", requireAuth, async (_req, res) => {
  const bids = await prisma.bid.findMany();
  return res.json(bids);
});

module.exports = router;
