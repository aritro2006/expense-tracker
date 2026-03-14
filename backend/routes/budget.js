const express      = require('express');
const router       = express.Router();
const auth         = require('../middleware/authMiddleware');
const Budget       = require('../models/Budget');
const Transaction  = require('../models/Transaction');

router.get('/status', auth, async (req, res) => {
  try {
    const now     = new Date();
    const month   = now.getMonth();
    const year    = now.getFullYear();
    const budgets = await Budget.find({ user: req.user.id, month, year });

    const transactions = await Transaction.find({
      user: req.user.id,
      date: {
        $gte: new Date(year, month, 1),
        $lt:  new Date(year, month + 1, 1)
      },
      amount: { $lt: 0 }
    });

    const result = budgets.map(b => {
      const spent     = transactions
        .filter(t => t.category === b.category)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      const percent   = Math.round((spent / b.limit) * 100);
      const remaining = b.limit - spent;
      return {
        _id:       b._id,
        category:  b.category,
        limit:     b.limit,
        spent,
        percent,
        remaining,
        overspent: spent > b.limit
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Budget status error:', err.message);
    res.status(500).json({ message: 'Failed to load budget status' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { category, limit } = req.body;
    if (!category || !limit) return res.status(400).json({ message: 'Category and limit are required' });

    const now   = new Date();
    const month = now.getMonth();
    const year  = now.getFullYear();

    let budget = await Budget.findOne({ user: req.user.id, category, month, year });
    if (budget) {
      budget.limit = parseFloat(limit);
    } else {
      budget = new Budget({ user: req.user.id, category, limit: parseFloat(limit), month, year });
    }

    await budget.save();
    res.status(201).json(budget);
  } catch (err) {
    console.error('POST budget error:', err.message);
    res.status(500).json({ message: 'Failed to save budget' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const b = await Budget.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!b) return res.status(404).json({ message: 'Budget not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('DELETE budget error:', err.message);
    res.status(500).json({ message: 'Failed to delete budget' });
  }
});

module.exports = router;
