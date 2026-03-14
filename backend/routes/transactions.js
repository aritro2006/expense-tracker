const express     = require('express');
const router      = express.Router();
const auth        = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');

router.get('/', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id }).sort({ date: -1 });
    res.json(transactions);
  } catch (err) {
    console.error('GET transactions error:', err.message);
    res.status(500).json({ message: 'Failed to load transactions' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { text, amount, category, emoji, notes, account } = req.body;

    if (!text)   return res.status(400).json({ message: 'Description is required' });
    if (!amount) return res.status(400).json({ message: 'Amount is required' });

    const t = new Transaction({
      user:     req.user.id,
      text:     text.trim(),
      amount:   parseFloat(amount),
      category: category || 'Other',
      emoji:    emoji    || (parseFloat(amount) > 0 ? '💰' : '💸'),
      notes:    notes    || '',
      account:  account  || 'Main'
    });

    await t.save();
    res.status(201).json(t);
  } catch (err) {
    console.error('POST transaction error:', err.message);
    res.status(500).json({ message: 'Failed to save transaction: ' + err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const t = await Transaction.findOne({ _id: req.params.id, user: req.user.id });
    if (!t) return res.status(404).json({ message: 'Transaction not found' });

    const { text, amount, category, emoji, notes, account } = req.body;
    if (text     !== undefined) t.text     = text;
    if (amount   !== undefined) t.amount   = parseFloat(amount);
    if (category !== undefined) t.category = category;
    if (emoji    !== undefined) t.emoji    = emoji;
    if (notes    !== undefined) t.notes    = notes;
    if (account  !== undefined) t.account  = account;

    await t.save();
    res.json(t);
  } catch (err) {
    console.error('PUT transaction error:', err.message);
    res.status(500).json({ message: 'Failed to update transaction' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const t = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!t) return res.status(404).json({ message: 'Transaction not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('DELETE transaction error:', err.message);
    res.status(500).json({ message: 'Failed to delete transaction' });
  }
});

module.exports = router;
