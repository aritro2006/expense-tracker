const express     = require('express');
const router      = express.Router();
const auth        = require('../middleware/authMiddleware');
const Budget      = require('../models/Budget');
const Transaction = require('../models/Transaction');

router.get('/status', auth, async (req, res) => {
  try {
    const now = new Date();
    const budgets = await Budget.find({
      user: req.user.id, month: now.getMonth(), year: now.getFullYear()
    });
    const transactions = await Transaction.find({ user: req.user.id });
    const monthTx = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() &&
             d.getFullYear() === now.getFullYear() && t.amount < 0;
    });
    const result = budgets.map(b => {
      const spent   = monthTx.filter(t => t.category === b.category).reduce((s,t) => s + Math.abs(t.amount), 0);
      const percent = Math.min(Math.round((spent / b.limit) * 100), 100);
      return { _id: b._id, category: b.category, limit: b.limit, spent, percent,
               remaining: b.limit - spent, overspent: spent > b.limit };
    });
    res.json(result);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { category, limit } = req.body;
    const now = new Date();
    let budget = await Budget.findOne({
      user: req.user.id, category, month: now.getMonth(), year: now.getFullYear()
    });
    if (budget) { budget.limit = limit; }
    else { budget = new Budget({ user: req.user.id, category, limit, month: now.getMonth(), year: now.getFullYear() }); }
    await budget.save();
    res.status(201).json(budget);
  } catch { res.status(500).json({ message: 'Server error' }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await Budget.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({ message: 'Deleted' });
  } catch { res.status(500).json({ message: 'Server error' }); }
});

module.exports = router;
