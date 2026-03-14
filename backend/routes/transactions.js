const express     = require('express');
const router      = express.Router();
const auth        = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');

router.get('/', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id }).sort({ date: -1 });
    res.json(transactions);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { text, amount, category, emoji, notes, account } = req.body;
    const t = new Transaction({
      user: req.user.id, text, amount,
      category: category || 'Other',
      emoji:    emoji    || (amount > 0 ? '💰' : '💸'),
      notes:    notes    || '',
      account:  account  || 'Main'
    });
    await t.save();
    res.status(201).json(t);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const t = await Transaction.findOne({ _id: req.params.id, user: req.user.id });
    if (!t) return res.status(404).json({ message: 'Not found' });
    const { text, amount, category, emoji, notes, account } = req.body;
    if (text     !== undefined) t.text     = text;
    if (amount   !== undefined) t.amount   = amount;
    if (category !== undefined) t.category = category;
    if (emoji    !== undefined) t.emoji    = emoji;
    if (notes    !== undefined) t.notes    = notes;
    if (account  !== undefined) t.account  = account;
    await t.save();
    res.json(t);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const t = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!t) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
