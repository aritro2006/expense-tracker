const express     = require('express');
const router      = express.Router();
const auth        = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');

const tips = [
  'Track every expense, no matter how small.',
  'Save at least 20% of your monthly income.',
  'Avoid impulse purchases — wait 24 hours before buying.',
  'Review your subscriptions monthly and cancel unused ones.',
  'Set a budget for each category and stick to it.',
  'Build an emergency fund covering 3-6 months of expenses.',
  'Pay yourself first — save before you spend.'
];

router.get('/daily-tip', auth, async (req, res) => {
  res.json({ tip: tips[Math.floor(Math.random() * tips.length)] });
});

router.get('/health-score', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.userId });
    const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const score   = income === 0 ? 0 : Math.min(100, Math.round(((income - expense) / income) * 100));
    res.json({ score });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/alerts', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.userId });
    const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const alerts  = [];
    if (expense > income) alerts.push('⚠️ Your expenses exceed your income!');
    if (income === 0)     alerts.push('ℹ️ No income recorded yet. Add your income to get started.');
    if (alerts.length === 0) alerts.push('✅ Your finances look healthy!');
    res.json({ alerts });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/weekly-summary', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.userId });
    const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    res.json({ income, expense, balance: income - expense });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
