const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

/* ==========================
   MIDDLEWARE
========================== */
app.use(cors());
app.use(express.json());

/* ==========================
   MONGODB CONNECTION
========================== */

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not defined in environment variables");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB connected successfully");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });

/* ==========================
   ROUTES
========================== */

app.get("/", (req, res) => {
  res.send("🚀 Expense Tracker Backend is Running");
});

app.use("/api/transactions", require("./routes/transactions"));

/* ==========================
   SERVER
========================== */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});