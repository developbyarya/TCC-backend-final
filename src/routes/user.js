const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { prisma } = require("../prisma");
const { requireAuth } = require("../middleware/auth");

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

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  return res.json({ token });
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
