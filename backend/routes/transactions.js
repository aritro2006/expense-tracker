const express = require("express");
const router = express.Router();
const Transaction = require("../models/Transaction");

// GET all
router.get("/", async (req, res) => {
  const transactions = await Transaction.find().sort({ createdAt: -1 });
  res.json(transactions);
});

// POST new
router.post("/", async (req, res) => {
  const { text, amount, type, category } = req.body;

  const signedAmount = type === "expense" ? -amount : amount;

  const transaction = new Transaction({
    text,
    amount: signedAmount,
    type,
    category
  });

  await transaction.save();
  res.json(transaction);
});

// UPDATE
router.put("/:id", async (req, res) => {
  const { text, amount, type, category } = req.body;
  const signedAmount = type === "expense" ? -amount : amount;

  const updated = await Transaction.findByIdAndUpdate(
    req.params.id,
    { text, amount: signedAmount, type, category },
    { new: true }
  );

  res.json(updated);
});

// DELETE
router.delete("/:id", async (req, res) => {
  await Transaction.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
