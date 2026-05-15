const express = require("express");
const { prisma } = require("../prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/new", requireAuth, async (req, res) => {
  const bid = await prisma.bid.create({
    data: {
      artworksId: req.body.artworks_id,
      amount: req.body.ammount,
      bidById: req.user.id,
      status: "OPEN",
      timestamp: new Date(),
    },
  });

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
  const [low, high] = await Promise.all([
    prisma.bid.findFirst({ orderBy: { amount: "asc" } }),
    prisma.bid.findFirst({ orderBy: { amount: "desc" } }),
  ]);

  return res.json({ low, high });
});

router.get("/", requireAuth, async (_req, res) => {
  const bids = await prisma.bid.findMany();
  return res.json(bids);
});

module.exports = router;
