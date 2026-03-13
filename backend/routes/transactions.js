const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');

// GET all transactions for logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id }).sort({ date: 1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST create new transaction
router.post('/', auth, async (req, res) => {
  const { text, amount } = req.body;
  try {
    const transaction = new Transaction({ user: req.user.id, text, amount });
    await transaction.save();
    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE transaction
router.delete('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    if (transaction.user.toString() !== req.user.id)
      return res.status(401).json({ message: 'Not authorized' });
    await transaction.deleteOne();
    res.json({ message: 'Transaction deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
