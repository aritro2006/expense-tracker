const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("./models/User");
const Transaction = require("./models/Transaction");
const authMiddleware = require("./middleware/auth");

const app = express();

app.use(cors());
app.use(express.json());

/* ================= MONGODB ================= */

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

/* ================= AUTH ROUTES ================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword
    });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ================= TRANSACTION ROUTES ================= */

app.get("/api/transactions", authMiddleware, async (req, res) => {
  const transactions = await Transaction.find({ user: req.user.id });
  res.json(transactions);
});

app.post("/api/transactions", authMiddleware, async (req, res) => {
  const { text, amount, category } = req.body;

  const transaction = await Transaction.create({
    text,
    amount,
    category,
    user: req.user.id
  });

  res.json(transaction);
});

app.delete("/api/transactions/:id", authMiddleware, async (req, res) => {
  await Transaction.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});