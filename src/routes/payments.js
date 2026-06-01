const express = require("express");
const { prisma } = require("../prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /payments:
 *   post:
 *     summary: Create a payment record for a bid
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ammounts:
 *                 type: number
 *               fee:
 *                 type: number
 *               for_bid:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment created
 */
/**
 * @openapi
 * /payments:
 *   get:
 *     summary: List payments for authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of payment records
 */
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
    include: {
      bid: {
        include: {
          artwork: {
            include: {artist: true}
          },
        },
      },
    },
    orderBy: { timestamp: 'desc' },
  });

  const formattedPayments = payments.map((p) => ({
    id: p.id,
    amount: p.amount,
    fee: p.fee,
    bidId: p.bidId,
    paidById: p.paidById,
    timestamp: p.timestamp,
    artworkId: p.bid?.artwork?.id || '',
    artworkTitle: p.bid?.artwork?.nama_karya || '',
    artworkImageUrl: p.bid?.artwork?.image_url || '',
    artistName: p.bid?.artwork?.artist?.alt_name || p.bid?.artwork?.artist?.full_name || p.bid?.artwork?.artist?.username || '',
    paymentMethod: 'Bank Transfer',
  }));

  return res.json(formattedPayments);
});


module.exports = router;
