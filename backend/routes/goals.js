const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');
const Goal    = require('../models/Goal');

router.get('/', auth, async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(goals);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, targetAmount, savedAmount, deadline, emoji } = req.body;
    const g = new Goal({
      user: req.user.id, title, targetAmount,
      savedAmount: savedAmount || 0,
      deadline:    deadline    || null,
      emoji:       emoji       || '🎯'
    });
    await g.save();
    res.status(201).json(g);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const g = await Goal.findOne({ _id: req.params.id, user: req.user.id });
    if (!g) return res.status(404).json({ message: 'Not found' });
    const { title, targetAmount, savedAmount, deadline, emoji } = req.body;
    if (title        !== undefined) g.title        = title;
    if (targetAmount !== undefined) g.targetAmount = targetAmount;
    if (savedAmount  !== undefined) g.savedAmount  = savedAmount;
    if (deadline     !== undefined) g.deadline     = deadline;
    if (emoji        !== undefined) g.emoji        = emoji;
    await g.save();
    res.json(g);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Goal.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({ message: 'Deleted' });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
