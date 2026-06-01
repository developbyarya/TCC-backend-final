const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { redis, connectRedis } = require("../redis");

const router = express.Router();

/**
 * @openapi
 * /notification:
 *   get:
 *     summary: List notifications for authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of notifications
 */
/**
 * @openapi
 * /notification/read/{id}:
 *   put:
 *     summary: Mark a notification as read (delete)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deletion result
 */
const parseNotificationValue = (id, value) => {
  try {
    const parsed = JSON.parse(value);
    return { id, ...parsed };
  } catch (err) {
    return { id, message: value };
  }
};

router.get("/", requireAuth, async (req, res) => {
  const pattern = `notificationBid:user:${req.user.id}:*`;

  try {
    await connectRedis();
    const keys = [];
    for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      keys.push(key);
    }

    if (keys.length === 0) {
      return res.json([]);
    }

    const values = await redis.mGet(keys);
    const notifications = values
      .map((value, index) => {
        if (!value) {
          return null;
        }
        const notificationId = keys[index].split(":").pop();
        return parseNotificationValue(notificationId, value);
      })
      .filter(Boolean);

    return res.json(notifications);
  } catch (err) {
    console.error("Failed to read notifications", err.message || err);
    return res.status(500).json({ message: "Failed to read notifications" });
  }
});

router.put("/read/:id", requireAuth, async (req, res) => {
  const key = `notificationBid:user:${req.user.id}:${req.params.id}`;

  try {
    await connectRedis();
    const removed = await redis.del(key);
    return res.json({ deleted: removed > 0 });
  } catch (err) {
    console.error("Failed to delete notification", err.message || err);
    return res.status(500).json({ message: "Failed to delete notification" });
  }
});

module.exports = router;
