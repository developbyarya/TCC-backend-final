const express = require("express");
const { randomUUID } = require("crypto");
const { prisma } = require("../prisma");
const { requireAuth } = require("../middleware/auth");
const { redis, connectRedis } = require("../redis");

const router = express.Router();

router.post("/new", requireAuth, async (req, res) => {
  const artworksId = req.body.artworks_id;
  const amount = req.body.ammount;
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ message: "amount must be a positive number" });
  }

  const previousHighest = await prisma.bid.findFirst({
    where: { artworksId, status: { not: "FAILED" } },
    orderBy: { amount: "desc" },
  });

  const artwork = await prisma.artwork.findUnique({
    where: { id: artworksId },
    select: { nama_karya: true },
  });
  const artworkName = artwork?.nama_karya || "Karya Seni";

  if (previousHighest && numericAmount <= previousHighest.amount) {
    return res
      .status(400)
      .json({ message: "Bid must be higher than current highest" });
  }

  try {
    await connectRedis();
  } catch (err) {
    return res.status(500).json({ message: "Failed to connect to wallet" });
  }

  const walletKey = `wallet:balance:${req.user.id}`;
  let currentBalance = 0;

  try {
    const storedBalance = await redis.get(walletKey);
    currentBalance = storedBalance ? Number(storedBalance) : 0;
  } catch (err) {
    return res.status(500).json({ message: "Failed to read wallet balance" });
  }

  if (!Number.isFinite(currentBalance)) {
    return res.status(500).json({ message: "Stored balance is invalid" });
  }

  if (currentBalance < numericAmount) {
    return res.status(400).json({ message: "Insufficient wallet balance" });
  }

  await prisma.bid.updateMany({
    where: {
      artworksId,
      status: { in: ["OPEN", "TERTINGGI"] },
    },
    data: { status: "OUTBID" },
  });

  const bid = await prisma.bid.create({
    data: {
      artworksId,
      amount: numericAmount,
      bidById: req.user.id,
      status: "TERTINGGI",
      timestamp: new Date(),
    },
  });

  let updatedBalance;
  try {
    updatedBalance = await redis.incrByFloat(walletKey, -numericAmount);
    const holdKey = `wallet:hold:${bid.id}`;
    const holdPayload = {
      bidId: bid.id,
      userId: req.user.id,
      artworksId,
      amount: numericAmount,
      createdAt: new Date().toISOString(),
    };
    await redis.set(holdKey, JSON.stringify(holdPayload));
  } catch (err) {
    console.error("Failed to place wallet hold", err);
    return res.status(500).json({ message: "Failed to place wallet hold" });
  }

  const isNewHighest = !previousHighest || numericAmount > previousHighest.amount;
  const shouldNotify =
    isNewHighest && previousHighest && previousHighest.bidById !== req.user.id;

  if (shouldNotify) {
    const previousHoldKey = `wallet:hold:${previousHighest.id}`;
    try {
      const previousHold = await redis.get(previousHoldKey);
      if (previousHold) {
        const parsedHold = JSON.parse(previousHold);
        const refundAmount = Number(parsedHold.amount);
        const previousWalletKey = `wallet:balance:${previousHighest.bidById}`;

        if (Number.isFinite(refundAmount) && refundAmount > 0) {
          await redis.incrByFloat(previousWalletKey, refundAmount);
        }

        await redis.del(previousHoldKey);
      }
    } catch (err) {
      console.error("Failed to refund previous hold", err.message || err);
    }

    const notificationId = randomUUID();
    const key = `notificationBid:user:${previousHighest.bidById}:${notificationId}`;
    const message = `Penawaran Anda untuk ${artworkName} telah dilewati. Bid tertinggi baru: ${numericAmount}.`;
    const payload = {
      id: notificationId,
      message,
      bidId: bid.id,
      artworksId,
      artworkName,
      createdAt: new Date().toISOString(),
    };

    try {
      await redis.set(key, JSON.stringify(payload));
    } catch (err) {
      console.error("Failed to store bid notification", err.message || err);
    }
  }

  return res.status(201).json({ ...bid, walletBalance: Number(updatedBalance) });
});

router.put("/:id/cancle", requireAuth, async (req, res) => {
  const bid = await prisma.bid.update({
    where: { id: req.params.id },
    data: { status: "FAILED" },
  });

  return res.json(bid);
});

router.put("/update", async (_req, res) => {
  const now = new Date();
  const updated = [];
  const skipped = [];

  try {
    await connectRedis();
  } catch (err) {
    return res.status(500).json({ message: "Failed to connect to notifications" });
  }

  const artworksToClose = await prisma.artwork.findMany({
    where: {
      bid_close: false,
      close_bid_time: { not: null, lte: now },
    },
    select: { id: true, nama_karya: true },
  });

  for (const artwork of artworksToClose) {
    const highestBid = await prisma.bid.findFirst({
      where: { artworksId: artwork.id, status: { not: "FAILED" } },
      orderBy: { amount: "desc" },
    });

    if (!highestBid) {
      await prisma.artwork.update({
        where: { id: artwork.id },
        data: { bid_close: true },
      });
      skipped.push({ artworkId: artwork.id, reason: "no-bids" });
      continue;
    }

    await prisma.bid.updateMany({
      where: {
        artworksId: artwork.id,
        status: { not: "FAILED" },
        id: { not: highestBid.id },
      },
      data: { status: "OUTBID" },
    });

    const winningBid = await prisma.bid.update({
      where: { id: highestBid.id },
      data: { status: "TERTINGGI" },
    });

    await prisma.artwork.update({
      where: { id: artwork.id },
      data: { bid_close: true },
    });

    const notificationId = randomUUID();
    const key = `notificationBid:user:${winningBid.bidById}:${notificationId}`;
    const message = `Selamat! Penawaran Anda untuk ${artwork.nama_karya} menang dengan harga ${winningBid.amount}.`;
    const payload = {
      id: notificationId,
      message,
      bidId: winningBid.id,
      artworksId: artwork.id,
      artworkName: artwork.nama_karya,
      createdAt: new Date().toISOString(),
    };

    try {
      await redis.set(key, JSON.stringify(payload));
    } catch (err) {
      console.error("Failed to store winner notification", err.message || err);
    }

    updated.push({ artworkId: artwork.id, bidId: winningBid.id });
  }

  return res.json({ updated, skipped, total: updated.length });
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
