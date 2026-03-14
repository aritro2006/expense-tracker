const express     = require('express');
const router      = express.Router();
const auth        = require('../middleware/authMiddleware');
const Recurring   = require('../models/Recurring');
const Transaction = require('../models/Transaction');

router.get('/', auth, async (req, res) => {
  try {
    const items = await Recurring.find({ user: req.user.id });
    res.json(items);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { text, amount, type, category, emoji, dayOfMonth } = req.body;
    const finalAmount = type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
    const item = new Recurring({
      user: req.user.id, text, amount: finalAmount, type,
      category: category || 'Other', emoji: emoji || '🔄', dayOfMonth: dayOfMonth || 1
    });
    await item.save();
    res.status(201).json(item);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Recurring.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({ message: 'Deleted' });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.post('/process', auth, async (req, res) => {
  try {
    const items = await Recurring.find({ user: req.user.id, active: true });
    const now   = new Date();
    const added = [];
    for (const item of items) {
      const last = item.lastProcessed ? new Date(item.lastProcessed) : null;
      const alreadyDoneThisMonth = last &&
        last.getMonth() === now.getMonth() && last.getFullYear() === now.getFullYear();
      if (!alreadyDoneThisMonth && now.getDate() >= item.dayOfMonth) {
        const t = new Transaction({
          user: req.user.id, text: item.text, amount: item.amount,
          category: item.category, emoji: item.emoji, notes: 'Auto-added (recurring)'
        });
        await t.save();
        item.lastProcessed = now;
        await item.save();
        added.push(item.text);
      }
    }
    res.json({ added, count: added.length });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
