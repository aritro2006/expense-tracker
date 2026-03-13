const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');

// Get all budgets for current month
router.get('/', auth, async (req, res) => {
  try {
    const now = new Date();
    const budgets = await Budget.find({ user: req.user.id, month: now.getMonth(), year: now.getFullYear() });
    res.json(budgets);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// Set or update a budget
router.post('/', auth, async (req, res) => {
  const { category, limit } = req.body;
  const now = new Date();
  try {
    let budget = await Budget.findOne({ user: req.user.id, category, month: now.getMonth(), year: now.getFullYear() });
    if (budget) { budget.limit = limit; await budget.save(); }
    else { budget = new Budget({ user: req.user.id, category, limit, month: now.getMonth(), year: now.getFullYear() }); await budget.save(); }
    res.json(budget);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// Delete a budget
router.delete('/:id', auth, async (req, res) => {
  try {
    await Budget.findByIdAndDelete(req.params.id);
    res.json({ message: 'Budget deleted' });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

// Get budget status (spent vs limit per category)
router.get('/status', auth, async (req, res) => {
  try {
    const now = new Date();
    const budgets = await Budget.find({ user: req.user.id, month: now.getMonth(), year: now.getFullYear() });
    const transactions = await Transaction.find({ user: req.user.id });
    const monthTx = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.amount < 0;
    });

    const status = budgets.map(b => {
      const spent = monthTx.filter(t => t.category === b.category).reduce((s, t) => s + Math.abs(t.amount), 0);
      const percent = Math.min(Math.round((spent / b.limit) * 100), 100);
      const overspent = spent > b.limit;
      return { _id: b._id, category: b.category, limit: b.limit, spent, percent, overspent, remaining: b.limit - spent };
    });
    res.json(status);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
