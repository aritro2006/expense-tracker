const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

/* ================== MIDDLEWARE ================== */
app.use(cors());
app.use(express.json());

/* ================== MONGODB CONNECTION ================== */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

/* ================== ROUTES ================== */
app.use("/api/transactions", require("./routes/transactions"));

/* ================== HEALTH CHECK ROUTE ================== */
app.get("/", (req, res) => {
  res.send("Expense Tracker Backend Running 🚀");
});

/* ================== SERVER ================== */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});