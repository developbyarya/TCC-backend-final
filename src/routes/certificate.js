const express = require("express");
const { prisma } = require("../prisma");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

/**
 * @openapi
 * /certificate:
 *   post:
 *     summary: Create a certificate for an artwork after bidding closed
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               artworks_id:
 *                 type: string
 *               congratulation_sentence:
 *                 type: string
 *     responses:
 *       201:
 *         description: Certificate created
 */
/**
 * @openapi
 * /certificate/{id}:
 *   get:
 *     summary: Get certificate by id
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
 *         description: Certificate object
 *       404:
 *         description: Not found
 */
router.post("/", requireAuth, async (req, res) => {
  const artworksId = req.body.artworks_id || req.body.artwork_id;
  if (!artworksId) {
    return res.status(400).json({ message: "artworks_id is required" });
  }

  const artwork = await prisma.artwork.findUnique({
    where: { id: artworksId },
    include: { artist: true },
  });

  if (!artwork) {
    return res.status(404).json({ message: "Artwork not found" });
  }

  if (!artwork.close_bid_time) {
    return res.status(400).json({ message: "close_bid_time is not set" });
  }

  if (new Date(artwork.close_bid_time) > new Date()) {
    return res.status(400).json({ message: "Bidding is still open" });
  }

  const existingCertificate = await prisma.certificate.findUnique({
    where: { artworksId },
  });

  if (existingCertificate) {
    return res.status(409).json({ message: "Certificate already exists" });
  }

  const highestBid = await prisma.bid.findFirst({
    where: { artworksId, status: { not: "FAILED" } },
    orderBy: { amount: "desc" },
  });

  if (!highestBid) {
    return res.status(400).json({ message: "No bids found for artwork" });
  }

  const congratulationSentence =
    req.body.congratulation_sentence ||
    "Congratulations on your successful bid.";

  const certificate = await prisma.certificate.create({
    data: {
      artworksId,
      artist_altname:
        artwork.artist.alt_name || artwork.artist.full_name || artwork.artist.username,
      artwork_name: artwork.nama_karya,
      bid_price_highest: highestBid.amount,
      congratulation_sentence: congratulationSentence,
    },
  });

  return res.status(201).json(certificate);
});

router.get("/:id", requireAuth, async (req, res) => {
  const certificate = await prisma.certificate.findUnique({
    where: { id: req.params.id },
  });

  if (!certificate) {
    return res.status(404).json({ message: "Not found" });
  }

  return res.json(certificate);
});

module.exports = router;
