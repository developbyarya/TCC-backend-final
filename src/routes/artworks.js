const express = require("express");
const multer = require("multer");
const { prisma } = require("../prisma");
const { requireAuth, requireRole } = require("../middleware/auth");
const { uploadImageBuffer } = require("../services/gcs");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/create", requireAuth, requireRole(["SENIMAN"]), async (req, res) => {
  const artwork = await prisma.artwork.create({
    data: {
      nama_karya: req.body.nama_karya,
      deskripsi: req.body.deskripsi,
      katalog: req.body.katalog,
      tags: req.body.tags,
      min_bid_ammount: req.body.min_bid_ammount,
      open_bid_time: req.body.open_bid_time ? new Date(req.body.open_bid_time) : null,
      close_bid_time: req.body.close_bid_time ? new Date(req.body.close_bid_time) : null,
      artistId: req.user.id,
    },
  });

  return res.status(201).json(artwork);
});

router.get("/all", async (req, res) => {
  const katalog = req.query.katalog;
  const katalogFilter = katalog ? katalog.split(",") : undefined;

  const artworks = await prisma.artwork.findMany({
    where: katalogFilter ? { katalog: { in: katalogFilter } } : undefined,
    include: {artist: true},
  });

  return res.json(artworks);
});

router.get("/:id", async (req, res) => {
  const artwork = await prisma.artwork.findUnique({
    where: { id: req.params.id },
    include: {
      artist: true,
    },
  });

  if (!artwork) {
    return res.status(404).json({ message: "Not found" });
  }

  return res.json(artwork);
});

router.put("/:id/owns", requireAuth, async (req, res) => {
  const artwork = await prisma.artwork.update({
    where: { id: req.params.id },
    data: { ownerId: req.user.id },
  });

  return res.json(artwork);
});

router.put("/:id/detail", requireAuth, requireRole(["SENIMAN"]), async (req, res) => {
  const artwork = await prisma.artwork.update({
    where: { id: req.params.id, artistId: req.user.id },
    data: {
      nama_karya: req.body.nama_karya,
      deskripsi: req.body.deskripsi,
      katalog: req.body.katalog,
      tags: req.body.tags,
      min_bid_ammount: req.body.min_bid_ammount,
      open_bid_time: req.body.open_bid_time ? new Date(req.body.open_bid_time) : null,
      close_bid_time: req.body.close_bid_time ? new Date(req.body.close_bid_time) : null,
    },
  });

  return res.json(artwork);
});

router.delete(
  "/:id/delete",
  requireAuth,
  requireRole(["SENIMAN", "KURATOR"]),
  async (req, res) => {
    await prisma.artwork.delete({ where: { id: req.params.id } });
    return res.json({ message: "Deleted" });
  }
);

router.put(
  "/:id/verify",
  requireAuth,
  requireRole(["KURATOR"]),
  async (req, res) => {
    const artwork = await prisma.artwork.update({
      where: { id: req.params.id },
      data: { verification_status: "VERIFIED" },
    });

    return res.json(artwork);
  }
);

router.put(
  "/:id/unverify",
  requireAuth,
  requireRole(["KURATOR"]),
  async (req, res) => {
    const artwork = await prisma.artwork.update({
      where: { id: req.params.id },
      data: { verification_status: "UNVERIFIED" },
    });

    return res.json(artwork);
  }
);

router.post(
  "/:id/image",
  requireAuth,
  requireRole(["SENIMAN"]),
  upload.single("image"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    const artwork = await prisma.artwork.findFirst({
      where: { id: req.params.id, artistId: req.user.id },
    });

    if (!artwork) {
      return res.status(404).json({ message: "Artwork not found" });
    }

    const uploadResult = await uploadImageBuffer({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const updatedArtwork = await prisma.artwork.update({
      where: { id: req.params.id },
      data: { image_url: uploadResult.publicUrl },
    });

    return res.json({
      artwork: updatedArtwork,
      image_url: uploadResult.publicUrl,
      gs_uri: uploadResult.gsUri,
    });
  }
);

module.exports = router;
