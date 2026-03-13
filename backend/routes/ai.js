const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');

router.post('/analyze', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id });

    const income = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const balance = income - expense;

    const transactionList = transactions
      .slice(-20)
      .map(t => `- ${t.text}: ₹${Math.abs(t.amount)} (${t.amount > 0 ? 'income' : 'expense'}) on ${new Date(t.date).toDateString()}`)
      .join('\n');

    const systemPrompt = `You are a smart personal finance assistant. Analyze the user's transactions and give helpful, friendly, and specific financial advice. Keep responses concise and use bullet points. Always use ₹ for currency.`;

    const userPrompt = `Here are my recent transactions:\n${transactionList}\n\nSummary:\n- Total Income: ₹${income}\n- Total Expenses: ₹${expense}\n- Current Balance: ₹${balance}\n\n${req.body.message || 'Please analyze my finances and give me suggestions.'}`;

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
        max_tokens: 500
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not analyze your finances right now.';
    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: 'Server error during AI analysis.' });
  }
});

router.post('/chat', auth, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user.id });
    const income = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

    const transactionList = transactions
      .slice(-20)
      .map(t => `- ${t.text}: ₹${Math.abs(t.amount)} (${t.amount > 0 ? 'income' : 'expense'})`)
      .join('\n');

    const systemPrompt = `You are a helpful personal finance assistant for an expense tracker app. The user's financial data:\nTransactions:\n${transactionList}\nIncome: ₹${income}, Expenses: ₹${expense}, Balance: ₹${income - expense}\nAnswer questions about their finances helpfully and concisely. Use ₹ for currency.`;

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
          { role: 'user', content: req.body.message }
        ],
        max_tokens: 300
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not process that.';
    res.json({ reply });

  } catch (err) {
    res.status(500).json({ reply: 'Server error.' });
  }
});

module.exports = router;
