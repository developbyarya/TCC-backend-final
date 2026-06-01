const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { redis, connectRedis } = require("../redis");

const router = express.Router();

/**
 * @openapi
 * /wallet:
 *   get:
 *     summary: Get authenticated user's wallet balance
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current balance
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance:
 *                   type: number
 */
/**
 * @openapi
 * /wallet/topup:
 *   put:
 *     summary: Top up wallet balance
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: New balance
 */
const getWalletKey = (userId) => `wallet:balance:${userId}`;

router.get("/", requireAuth, async (req, res) => {
  try {
    await connectRedis();
    const key = getWalletKey(req.user.id);
    const storedBalance = await redis.get(key);
    const balance = storedBalance ? Number(storedBalance) : 0;

    if (storedBalance && Number.isNaN(balance)) {
      return res.status(500).json({ message: "Stored balance is invalid" });
    }

    return res.json({ balance });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch wallet balance" });
  }
});

router.put("/topup", requireAuth, async (req, res) => {
  const amount = req.body?.amount;
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ message: "amount must be a positive number" });
  }

  try {
    await connectRedis();
    const key = getWalletKey(req.user.id);
    const updatedBalance = await redis.incrByFloat(key, numericAmount);

    return res.json({ balance: Number(updatedBalance) });
  } catch (error) {
    return res.status(500).json({ message: "Failed to top up wallet" });
  }
});

module.exports = router;
