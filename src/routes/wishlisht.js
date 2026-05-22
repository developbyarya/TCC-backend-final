const express = require("express");
const { prisma } = require("../prisma");
const { requireAuth } = require("../middleware/auth");
const { redis, connectRedis } = require("../redis");

const router = express.Router();

// Get current user's wishlist (returns artwork objects)
router.get("/", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const key = `wishlist:${userId}`;

  try {
    await connectRedis();
    // members returns an array of artwork ids (strings)
    const members = await redis.sMembers(key);

    if (!members || members.length === 0) {
      return res.json({ wishlist: [] });
    }

    // fetch artworks by ids
    const artworks = await prisma.artwork.findMany({
      where: { id: { in: members } },
    });

    return res.json({ wishlist: artworks });
  } catch (err) {
    console.error("Failed to read wishlist from redis", err);
    // Fallback: return empty list on error
    return res.status(500).json({ message: "Failed to load wishlist" });
  }
});

// Add an artwork to wishlist. Body: { artworkId: "..." }
router.post("/", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const artworkId = req.body.artworkId;

  if (!artworkId) {
    return res.status(400).json({ message: "artworkId is required" });
  }

  // verify artwork exists
  const artwork = await prisma.artwork.findUnique({ where: { id: artworkId } });
  if (!artwork) {
    return res.status(404).json({ message: "Artwork not found" });
  }

  const key = `wishlist:${userId}`;

  try {
    await connectRedis();
    await redis.sAdd(key, artworkId);
    // Optionally set a TTL for wishlist keys (commented out). If desired, use: await redis.expire(key, 60 * 60 * 24 * 30);
    return res.status(201).json({ message: "Added to wishlist" });
  } catch (err) {
    console.error("Failed to add to wishlist", err);
    return res.status(500).json({ message: "Failed to add to wishlist" });
  }
});

// Remove an artwork from wishlist
router.delete("/:artworkId", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const artworkId = req.params.artworkId;
  const key = `wishlist:${userId}`;

  try {
    await connectRedis();
    const removed = await redis.sRem(key, artworkId);
    if (removed === 0) {
      return res.status(404).json({ message: "Artwork not in wishlist" });
    }

    return res.json({ message: "Removed from wishlist" });
  } catch (err) {
    console.error("Failed to remove from wishlist", err);
    return res.status(500).json({ message: "Failed to remove from wishlist" });
  }
});

module.exports = router;
