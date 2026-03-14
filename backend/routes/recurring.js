const express     = require('express');
const router      = express.Router();
const auth        = require('../middleware/authMiddleware');
const Recurring   = require('../models/Recurring');
const Transaction = require('../models/Transaction');

router.get('/', auth, async (req, res) => {
  try {
    const items = await Recurring.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error('GET recurring error:', err.message);
    res.status(500).json({ message: 'Failed to load recurring transactions' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { text, amount, type, category, emoji, dayOfMonth } = req.body;
    if (!text || !amount) return res.status(400).json({ message: 'Text and amount are required' });

    const finalAmount = type === 'expense' ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount));

    const item = new Recurring({
      user: req.user.id,
      text:       text.trim(),
      amount:     finalAmount,
      category:   category   || 'Other',
      emoji:      emoji      || '🔄',
      dayOfMonth: dayOfMonth || 1
    });

    await item.save();
    res.status(201).json(item);
  } catch (err) {
    console.error('POST recurring error:', err.message);
    res.status(500).json({ message: 'Failed to save recurring transaction' });
  }
});

router.post('/process', auth, async (req, res) => {
  try {
    const now   = new Date();
    const today = now.getDate();
    const items = await Recurring.find({ user: req.user.id });

    let count = 0;
    for (const item of items) {
      if (item.dayOfMonth !== today) continue;

      const alreadyDone = item.lastProcessed &&
        item.lastProcessed.getMonth()    === now.getMonth() &&
        item.lastProcessed.getFullYear() === now.getFullYear();

      if (alreadyDone) continue;

      const t = new Transaction({
        user:     req.user.id,
        text:     item.text,
        amount:   item.amount,
        category: item.category,
        emoji:    item.emoji,
        notes:    'Auto-added (recurring)',
        account:  'Main',
        date:     new Date()
      });
      await t.save();

      item.lastProcessed = new Date();
      await item.save();
      count++;
    }

    res.json({ count, message: `${count} recurring transaction(s) processed.` });
  } catch (err) {
    console.error('Process recurring error:', err.message);
    res.status(500).json({ message: 'Failed to process recurring transactions' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Recurring.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!item) return res.status(404).json({ message: 'Recurring item not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('DELETE recurring error:', err.message);
    res.status(500).json({ message: 'Failed to delete recurring transaction' });
  }
});

module.exports = router;
