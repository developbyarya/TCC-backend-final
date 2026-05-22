const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { prisma } = require("../prisma");
const { requireAuth } = require("../middleware/auth");
const { redis, connectRedis } = require("../redis");
const { randomUUID } = require("crypto");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, email, password } = req.body;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: username || undefined }, { email: email || undefined }],
    },
  });

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Access token (short-lived)
  const accessToken = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  // Refresh token (longer-lived) with a jti for revocation/rotation
  const refreshJti = randomUUID();
  const refreshToken = jwt.sign(
    { id: user.id, role: user.role, jti: refreshJti, type: "refresh" },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );

  // persist refresh token in redis with expiry (safe-guard server-side revocation)
  try {
    await connectRedis();
    // key: refresh:<userId>:<jti> -> value '1'
    await redis.set(`refresh:${user.id}:${refreshJti}`, "1", { EX: 30 * 24 * 60 * 60 });
  } catch (err) {
    console.error("Failed to store refresh token in redis", err.message || err);
    // continue — token still works (but can't be revoked)
  }

  return res.json({ token: accessToken, refreshToken });
});

router.post("/register", async (req, res) => {
  const { username, full_name, email, phone_number, password, role, alt_name } =
    req.body;

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      username,
      full_name,
      email,
      phone_number,
      role,
      alt_name,
      passwordHash,
    },
  });

  return res.status(201).json({ id: user.id });
});

// Exchange refresh token for a new access token (and rotate refresh token)
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ message: "Missing refreshToken" });
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);

    if (payload.type !== "refresh" || !payload.jti || !payload.id) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const key = `refresh:${payload.id}:${payload.jti}`;
    await connectRedis();
    const exists = await redis.exists(key);
    if (!exists) {
      return res.status(401).json({ message: "Refresh token revoked or not found" });
    }

    // rotate: remove old refresh token and issue a new one
    await redis.del(key);

    const newJti = randomUUID();
    const newRefreshToken = jwt.sign(
      { id: payload.id, role: payload.role, jti: newJti, type: "refresh" },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    await redis.set(`refresh:${payload.id}:${newJti}`, "1", { EX: 30 * 24 * 60 * 60 });

    const accessToken = jwt.sign({ id: payload.id, role: payload.role }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    return res.json({ token: accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

// Logout: revoke a refresh token (client should provide refreshToken)
router.post("/logout", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ message: "Missing refreshToken" });
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    if (payload.type !== "refresh" || !payload.jti || !payload.id) {
      return res.status(400).json({ message: "Invalid refresh token" });
    }

    await connectRedis();
    const key = `refresh:${payload.id}:${payload.jti}`;
    await redis.del(key);

    return res.json({ message: "Logged out" });
  } catch (error) {
    return res.status(400).json({ message: "Invalid refresh token" });
  }
});

router.get("/profile", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      username: true,
      full_name: true,
      email: true,
      phone_number: true,
      role: true,
      alt_name: true,
    },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.json({ user });
});

router.put("/update/profile", requireAuth, async (req, res) => {
  const { full_name, alt_name } = req.body;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { full_name, alt_name },
  });

  return res.json({ id: user.id });
});

router.put("/update/password", requireAuth, async (req, res) => {
  const { password } = req.body;

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash },
  });

  return res.json({ message: "Password updated" });
});

router.delete("/delete", requireAuth, async (req, res) => {
  await prisma.user.delete({ where: { id: req.user.id } });
  return res.json({ message: "Account deleted" });
});

module.exports = router;
