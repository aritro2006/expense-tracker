const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');

const callAI = async (systemPrompt, userPrompt, maxTokens = 500) => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://expense-tracker.vercel.app',
      'X-Title': 'Expense Tracker AI'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: maxTokens
    })
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Could not process request.';
};

const getContext = async (userId) => {
  const transactions = await Transaction.find({ user: userId });
  const income = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const list = transactions.slice(-30).map(t =>
    `- ${t.text}: ₹${Math.abs(t.amount)} (${t.amount > 0 ? 'income' : 'expense'}) on ${new Date(t.date).toDateString()}`
  ).join('\n');
  return { transactions, income, expense, balance: income - expense, list };
};

// Analyze
router.post('/analyze', auth, async (req, res) => {
  try {
    const ctx = await getContext(req.user.id);
    const reply = await callAI(
      'You are a smart personal finance assistant. Give helpful, friendly, specific financial advice using bullet points. Use ₹ for currency.',
      `Transactions:\n${ctx.list}\n\nIncome: ₹${ctx.income}, Expenses: ₹${ctx.expense}, Balance: ₹${ctx.balance}\n\n${req.body.message}`
    );
    res.json({ reply });
  } catch { res.status(500).json({ reply: 'Server error during analysis.' }); }
});

// Chat
router.post('/chat', auth, async (req, res) => {
  try {
    const ctx = await getContext(req.user.id);
    const reply = await callAI(
      `You are a personal finance assistant. User data:\n${ctx.list}\nIncome: ₹${ctx.income}, Expenses: ₹${ctx.expense}, Balance: ₹${ctx.balance}\nAnswer concisely. Use ₹.`,
      req.body.message, 300
    );
    res.json({ reply });
  } catch { res.status(500).json({ reply: 'Server error.' }); }
});

// Monthly Report
router.get('/monthly-report', auth, async (req, res) => {
  try {
    const ctx = await getContext(req.user.id);
    const now = new Date();
    const monthTx = ctx.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const mIncome = monthTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const mExpense = monthTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const mList = monthTx.map(t => `- ${t.text}: ₹${Math.abs(t.amount)} (${t.amount > 0 ? 'income' : 'expense'})`).join('\n');
    const reply = await callAI(
      'You are a financial report generator. Write a detailed, friendly monthly financial report in 4-5 sentences. Mention income, expenses, savings rate, biggest expense, and one key recommendation. Use ₹.',
      `Month: ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}\nTransactions:\n${mList || 'No transactions this month.'}\nIncome: ₹${mIncome}, Expenses: ₹${mExpense}, Saved: ₹${mIncome - mExpense}`,
      400
    );
    res.json({ reply, stats: { income: mIncome, expense: mExpense, saved: mIncome - mExpense, count: monthTx.length } });
  } catch { res.status(500).json({ reply: 'Server error.' }); }
});

// Spending Prediction
router.get('/predict', auth, async (req, res) => {
  try {
    const ctx = await getContext(req.user.id);
    const reply = await callAI(
      'You are a financial prediction AI. Based on spending history, predict next month expenses in 2-3 sentences. Give a specific ₹ figure and reasoning. Be concise.',
      `Recent transactions:\n${ctx.list}\nTotal expenses so far: ₹${ctx.expense}`,
      200
    );
    res.json({ reply });
  } catch { res.status(500).json({ reply: 'Prediction unavailable.' }); }
});

// Smart Alerts + Budget Overspend
router.get('/alerts', auth, async (req, res) => {
  try {
    const ctx = await getContext(req.user.id);
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const weekTx = ctx.transactions.filter(t => new Date(t.date) >= weekAgo);
    const weekExpense = weekTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

    // Get budget overspend info
    const budgets = await Budget.find({ user: req.user.id, month: now.getMonth(), year: now.getFullYear() });
    const monthTx = ctx.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.amount < 0;
    });
    const overspentCategories = budgets.map(b => {
      const spent = monthTx.filter(t => t.category === b.category).reduce((s, t) => s + Math.abs(t.amount), 0);
      return spent > b.limit ? `${b.category} (spent ₹${spent} of ₹${b.limit} limit)` : null;
    }).filter(Boolean);

    const budgetContext = overspentCategories.length > 0
      ? `\nOVERSPENT CATEGORIES THIS MONTH: ${overspentCategories.join(', ')}`
      : '\nAll budgets are within limits.';

    const reply = await callAI(
      'You are a financial alert system. Return a JSON array of 2-4 alert objects with fields: type (warning/info/success), message (short, max 14 words). If there are overspent categories, include warning alerts for them. Only return valid JSON array, nothing else.',
      `Balance: ₹${ctx.balance}, Total income: ₹${ctx.income}, Total expenses: ₹${ctx.expense}, This week expenses: ₹${weekExpense}, Transaction count: ${ctx.transactions.length}${budgetContext}`,
      200
    );
    let alerts = [];
    try { alerts = JSON.parse(reply.match(/\[[\s\S]*\]/)?.[0] || '[]'); } catch { alerts = [{ type: 'info', message: 'Keep tracking your expenses!' }]; }
    res.json({ alerts });
  } catch { res.status(500).json({ alerts: [] }); }
});

// Auto Categorize
router.post('/categorize', auth, async (req, res) => {
  try {
    const { text } = req.body;
    const reply = await callAI(
      'You are a transaction categorizer. Return ONLY a JSON object with two fields: "category" (one of: Food, Transport, Shopping, Entertainment, Health, Education, Salary, Business, Utilities, Other) and "emoji" (one relevant emoji). Nothing else, just valid JSON.',
      `Transaction: "${text}"`, 60
    );
    let result = { category: 'Other', emoji: '💰' };
    try { result = JSON.parse(reply.match(/\{[\s\S]*\}/)?.[0] || '{}'); } catch {}
    res.json(result);
  } catch { res.json({ category: 'Other', emoji: '💰' }); }
});

// Weekly Summary
router.get('/weekly-summary', auth, async (req, res) => {
  try {
    const ctx = await getContext(req.user.id);
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const prevWeekAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
    const thisWeek = ctx.transactions.filter(t => new Date(t.date) >= weekAgo);
    const lastWeek = ctx.transactions.filter(t => new Date(t.date) >= prevWeekAgo && new Date(t.date) < weekAgo);
    const thisExpense = thisWeek.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const lastExpense = lastWeek.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const diff = thisExpense - lastExpense;
    const trend = diff > 0 ? `₹${diff.toFixed(0)} more` : `₹${Math.abs(diff).toFixed(0)} less`;
    const trendIcon = diff > 0 ? '📈' : '📉';
    res.json({
      thisWeekExpense: thisExpense,
      lastWeekExpense: lastExpense,
      trend, trendIcon,
      transactionCount: thisWeek.length,
      summary: `This week: ₹${thisExpense.toFixed(0)} spent, ${trend} than last week ${trendIcon}`
    });
  } catch { res.status(500).json({ summary: 'Weekly data unavailable.' }); }
});

// Daily Tip
router.get('/daily-tip', auth, async (req, res) => {
  try {
    const ctx = await getContext(req.user.id);
    const reply = await callAI(
      'You are a personal finance coach. Give ONE short, practical, personalized money-saving tip in 1-2 sentences max. Make it specific to the user data. Start with an emoji.',
      `Balance: ₹${ctx.balance}, Income: ₹${ctx.income}, Expenses: ₹${ctx.expense}`,
      80
    );
    res.json({ tip: reply });
  } catch { res.json({ tip: '💡 Track every expense, no matter how small — small amounts add up fast!' }); }
});

// Smart Transaction Parse
router.post('/parse-transaction', auth, async (req, res) => {
  try {
    const { text } = req.body;
    const reply = await callAI(
      'You are a transaction parser. Extract transaction details and return ONLY a JSON object with fields: "text" (clean description), "amount" (number, positive), "type" ("income" or "expense"). Nothing else, just valid JSON.',
      `User input: "${text}"`, 80
    );
    let result = { text, amount: 0, type: 'expense' };
    try { result = JSON.parse(reply.match(/\{[\s\S]*\}/)?.[0] || '{}'); } catch {}
    res.json(result);
  } catch { res.status(500).json({ text: req.body.text, amount: 0, type: 'expense' }); }
});

// Budget Overspend AI Warning
router.post('/budget-warning', auth, async (req, res) => {
  try {
    const { category, spent, limit } = req.body;
    const percent = Math.round((spent / limit) * 100);
    const reply = await callAI(
      'You are a budget coach. Write ONE short, friendly but firm overspend warning in 1-2 sentences. Start with a warning emoji. Be specific with numbers.',
      `Category: ${category}, Budget limit: ₹${limit}, Amount spent: ₹${spent}, Percentage used: ${percent}%`,
      80
    );
    res.json({ warning: reply });
  } catch { res.json({ warning: `⚠️ You've exceeded your ${category} budget!` }); }
});

module.exports = router;
