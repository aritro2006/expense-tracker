const express = require("express");
const Transaction = require("../models/Transaction");
const auth = require("../middleware/authMiddleware");

const router = express.Router();

/* GET USER TRANSACTIONS */
router.get("/", auth, async (req, res) => {
  const transactions = await Transaction.find({ user: req.user.id });
  res.json(transactions);
});

/* ADD TRANSACTION */
router.post("/", auth, async (req, res) => {
  const transaction = await Transaction.create({
    user: req.user.id,
    text: req.body.text,
    amount: req.body.amount,
    category: req.body.category
  });

  res.status(201).json(transaction);
});

/* DELETE */
router.delete("/:id", auth, async (req, res) => {
  await Transaction.deleteOne({ _id: req.params.id, user: req.user.id });
  res.json({ message: "Deleted" });
});

module.exports = router;