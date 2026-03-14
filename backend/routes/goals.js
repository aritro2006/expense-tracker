const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');
const Goal    = require('../models/Goal');

router.get('/', auth, async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.json(goals);
  } catch (err) {
    console.error('GET goals error:', err.message);
    res.status(500).json({ message: 'Failed to load goals' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { title, targetAmount, savedAmount, deadline, emoji } = req.body;
    if (!title || !targetAmount) return res.status(400).json({ message: 'Title and target amount are required' });

    const goal = new Goal({
      user: req.user.id,
      title:        title.trim(),
      targetAmount: parseFloat(targetAmount),
      savedAmount:  parseFloat(savedAmount) || 0,
      deadline:     deadline || null,
      emoji:        emoji    || '🎯'
    });

    await goal.save();
    res.status(201).json(goal);
  } catch (err) {
    console.error('POST goal error:', err.message);
    res.status(500).json({ message: 'Failed to create goal' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, user: req.user.id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });

    const { title, targetAmount, savedAmount, deadline, emoji } = req.body;
    if (title        !== undefined) goal.title        = title;
    if (targetAmount !== undefined) goal.targetAmount = parseFloat(targetAmount);
    if (savedAmount  !== undefined) goal.savedAmount  = parseFloat(savedAmount);
    if (deadline     !== undefined) goal.deadline     = deadline;
    if (emoji        !== undefined) goal.emoji        = emoji;

    await goal.save();
    res.json(goal);
  } catch (err) {
    console.error('PUT goal error:', err.message);
    res.status(500).json({ message: 'Failed to update goal' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('DELETE goal error:', err.message);
    res.status(500).json({ message: 'Failed to delete goal' });
  }
});

module.exports = router;
