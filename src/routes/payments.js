const express = require("express");
const { prisma } = require("../prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  const payment = await prisma.payment.create({
    data: {
      amount: req.body.ammounts,
      fee: req.body.fee ?? 0.035,
      bidId: req.body.for_bid,
      paidById: req.user.id,
      timestamp: new Date(),
    },
  });

  return res.status(201).json(payment);
});

router.get("/", requireAuth, async (req, res) => {
  const payments = await prisma.payment.findMany({
    where: { paidById: req.user.id },
  });

  return res.json(payments);
});

module.exports = router;
