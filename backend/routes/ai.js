const express     = require('express');
const router      = express.Router();
const auth        = require('../middleware/authMiddleware');
const Transaction = require('../models/Transaction');
const Budget      = require('../models/Budget');

const callAI = async (systemPrompt, userPrompt, maxTokens = 500) => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type':  'application/json',
      'HTTP-Referer':  'https://expense-tracker.vercel.app',
      'X-Title':       'Expense Tracker AI'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.1-8b-instruct:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.1
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${errText}`);
  }
  const data = await response.json();
  if (!data.choices || !data.choices[0]) throw new Error('No choices returned from AI');
  return data.choices[0].message?.content || '';
};

const getContext = async (userId) => {
  const transactions = await Transaction.find({ user: userId });
  const income  = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const list    = transactions.slice(-30).map(t =>
    `- ${t.text}: ₹${Math.abs(t.amount)} (${t.amount > 0 ? 'income' : 'expense'}) on ${new Date(t.date).toDateString()}`
  ).join('\n');
  return { transactions, income, expense, balance: income - expense, list };
};

// ─── /analyze ────────────────────────────────────────────────────────────────
router.post('/analyze', auth, async (req, res) => {
  try {
    const ctx   = await getContext(req.user.id);
    const reply = await callAI(
      'You are a smart personal finance assistant. Give helpful, friendly, specific financial advice using bullet points. Use ₹ for currency.',
      `Transactions:\n${ctx.list || 'No transactions yet.'}\nIncome: ₹${ctx.income}, Expenses: ₹${ctx.expense}, Balance: ₹${ctx.balance}\n\nUser message: ${req.body.message}`,
      500
    );
    res.json({ reply: reply || 'No advice available right now.' });
  } catch (err) {
    console.error('analyze error:', err.message);
    res.status(500).json({ reply: 'AI analysis failed. Please try again.' });
  }
});

// ─── /chat ────────────────────────────────────────────────────────────────────
router.post('/chat', auth, async (req, res) => {
  try {
    const ctx   = await getContext(req.user.id);
    const reply = await callAI(
      `You are a personal finance assistant. User financial data:\n${ctx.list || 'No transactions yet.'}\nIncome: ₹${ctx.income}, Expenses: ₹${ctx.expense}, Balance: ₹${ctx.balance}\nAnswer concisely and helpfully. Use ₹ for currency.`,
      req.body.message,
      300
    );
    res.json({ reply: reply || 'I could not process that. Try again.' });
  } catch (err) {
    console.error('chat error:', err.message);
    res.status(500).json({ reply: 'Chat failed. Please try again.' });
  }
});

// ─── /monthly-report ─────────────────────────────────────────────────────────
router.get('/monthly-report', auth, async (req, res) => {
  try {
    const ctx = await getContext(req.user.id);
    const now = new Date();
    const mTx = ctx.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const mInc  = mTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const mExp  = mTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const mList = mTx.map(t => `- ${t.text}: ₹${Math.abs(t.amount)} (${t.amount > 0 ? 'income' : 'expense'})`).join('\n');
    const reply = await callAI(
      'You are a financial report generator. Write a detailed, friendly monthly report in 4-5 sentences. Mention income, expenses, savings rate, biggest expense category, and one key recommendation. Use ₹.',
      `Month: ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}\n${mList || 'No transactions this month.'}\nTotal Income: ₹${mInc}, Total Expenses: ₹${mExp}, Net Saved: ₹${mInc - mExp}`,
      400
    );
    res.json({ reply: reply || 'Report unavailable.', stats: { income: mInc, expense: mExp, saved: mInc - mExp, count: mTx.length } });
  } catch (err) {
    console.error('monthly-report error:', err.message);
    res.status(500).json({ reply: 'Report generation failed. Please try again.' });
  }
});

// ─── /predict ─────────────────────────────────────────────────────────────────
router.get('/predict', auth, async (req, res) => {
  try {
    const ctx   = await getContext(req.user.id);
    const reply = await callAI(
      'You are a financial prediction AI. Based on spending history, predict next month\'s expenses in 2-3 sentences. Give a specific ₹ figure and your reasoning.',
      `Recent transactions:\n${ctx.list || 'No transactions yet.'}\nTotal expenses so far: ₹${ctx.expense}`,
      200
    );
    res.json({ reply: reply || 'Prediction unavailable.' });
  } catch (err) {
    console.error('predict error:', err.message);
    res.status(500).json({ reply: 'Prediction unavailable. Please try again.' });
  }
});

// ─── /alerts ──────────────────────────────────────────────────────────────────
router.get('/alerts', auth, async (req, res) => {
  try {
    const ctx     = await getContext(req.user.id);
    const now     = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const weekExp = ctx.transactions
      .filter(t => new Date(t.date) >= weekAgo && t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const budgets = await Budget.find({ user: req.user.id, month: now.getMonth(), year: now.getFullYear() });
    const monthTx = ctx.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.amount < 0;
    });
    const overspent = budgets.map(b => {
      const spent = monthTx.filter(t => t.category === b.category).reduce((s, t) => s + Math.abs(t.amount), 0);
      return spent > b.limit ? `${b.category} (₹${spent.toFixed(0)}/₹${b.limit})` : null;
    }).filter(Boolean);

    const reply = await callAI(
      'You are a financial alert system. Return ONLY a valid JSON array of 2-4 alert objects. Each object must have exactly two fields: "type" (one of: warning, info, success) and "message" (max 15 words). Return nothing except the JSON array.',
      `Balance: ₹${ctx.balance.toFixed(0)}, Income: ₹${ctx.income.toFixed(0)}, Expenses: ₹${ctx.expense.toFixed(0)}, This week spending: ₹${weekExp.toFixed(0)}${overspent.length ? '\nOverspent categories: ' + overspent.join(', ') : ''}`,
      250
    );

    let alerts = [];
    try {
      const match = reply.match(/\[[\s\S]*\]/);
      if (match) alerts = JSON.parse(match[0]);
    } catch {
      alerts = [{ type: 'info', message: 'Keep tracking your expenses daily!' }];
    }
    if (!Array.isArray(alerts) || !alerts.length) {
      alerts = [{ type: 'info', message: 'Keep tracking your expenses daily!' }];
    }
    res.json({ alerts });
  } catch (err) {
    console.error('alerts error:', err.message);
    res.json({ alerts: [{ type: 'info', message: 'Keep tracking your expenses daily!' }] });
  }
});

// ─── /categorize ──────────────────────────────────────────────────────────────
router.post('/categorize', auth, async (req, res) => {
  try {
    const { text } = req.body;
    const reply = await callAI(
      'You are a transaction categorizer. Return ONLY a valid JSON object with exactly two fields: "category" (must be one of: Food, Transport, Shopping, Entertainment, Health, Education, Salary, Business, Utilities, Other) and "emoji" (one relevant emoji). Return nothing except the JSON object.',
      `Categorize this transaction: "${text}"`,
      80
    );
    let result = { category: 'Other', emoji: '💰' };
    try {
      const match = reply.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.category) result.category = parsed.category;
        if (parsed.emoji)    result.emoji    = parsed.emoji;
      }
    } catch {}
    res.json(result);
  } catch (err) {
    console.error('categorize error:', err.message);
    res.json({ category: 'Other', emoji: '💰' });
  }
});

// ─── /weekly-summary ──────────────────────────────────────────────────────────
router.get('/weekly-summary', auth, async (req, res) => {
  try {
    const ctx  = await getContext(req.user.id);
    const now  = new Date();
    const wk1  = new Date(now - 7  * 86400000);
    const wk2  = new Date(now - 14 * 86400000);
    const thisE = ctx.transactions.filter(t => new Date(t.date) >= wk1 && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const lastE = ctx.transactions.filter(t => new Date(t.date) >= wk2 && new Date(t.date) < wk1 && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const diff  = thisE - lastE;
    res.json({
      summary: `This week: ₹${thisE.toFixed(0)} spent${lastE > 0 ? `, ₹${Math.abs(diff).toFixed(0)} ${diff > 0 ? 'more 📈' : 'less 📉'} than last week` : ''}.`
    });
  } catch (err) {
    console.error('weekly-summary error:', err.message);
    res.status(500).json({ summary: 'Weekly summary unavailable.' });
  }
});

// ─── /daily-tip ───────────────────────────────────────────────────────────────
router.get('/daily-tip', auth, async (req, res) => {
  try {
    const ctx   = await getContext(req.user.id);
    const reply = await callAI(
      'Give ONE short practical money-saving tip personalized to this user\'s spending. Max 2 sentences. Start with a relevant emoji.',
      `Balance: ₹${ctx.balance.toFixed(0)}, Income: ₹${ctx.income.toFixed(0)}, Expenses: ₹${ctx.expense.toFixed(0)}`,
      100
    );
    res.json({ tip: reply || '💡 Track every expense, no matter how small!' });
  } catch (err) {
    console.error('daily-tip error:', err.message);
    res.json({ tip: '💡 Track every expense, no matter how small!' });
  }
});

// ─── /parse-transaction ───────────────────────────────────────────────────────
// This is the most critical route — fixed income/expense detection
router.post('/parse-transaction', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ text: '', amount: 0, type: 'expense' });

    const reply = await callAI(
      `You are a financial transaction parser. Extract structured data from natural language.

INCOME keywords (type = "income"):
got, received, earned, salary, income, bonus, allowance, pocket money, stipend, refund, cashback, gift, prize, won, scholarship, commission, dividend, credited, deposited, freelance, payment received, collected, reimbursement

EXPENSE keywords (type = "expense"):
spent, paid, bought, purchased, cost, bill, fee, rent, emi, subscription, recharge, food, lunch, dinner, breakfast, travel, uber, ola, metro, bus, shopping, ordered, delivery, medical, doctor, medicine

RULES:
1. Extract the numeric amount from the text (positive number only)
2. Create a clean 2-5 word description
3. Determine type strictly from keywords above
4. Return ONLY valid JSON — nothing else, no explanation

EXAMPLES:
"got 2000 pocket money" → {"text":"Pocket Money","amount":2000,"type":"income"}
"received salary 15000" → {"text":"Salary","amount":15000,"type":"income"}
"earned 5000 freelance" → {"text":"Freelance Payment","amount":5000,"type":"income"}
"spent 150 on lunch" → {"text":"Lunch","amount":150,"type":"expense"}
"paid 800 electricity bill" → {"text":"Electricity Bill","amount":800,"type":"expense"}
"bought groceries 600" → {"text":"Groceries","amount":600,"type":"expense"}
"recharge 299" → {"text":"Mobile Recharge","amount":299,"type":"expense"}
"bonus 3000 received" → {"text":"Bonus","amount":3000,"type":"income"}`,
      `Parse this: "${text}"`,
      120
    );

    let result = { text: text, amount: 0, type: 'expense' };
    try {
      const match = reply.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.text   && parsed.text.trim().length > 0) result.text   = parsed.text.trim();
        if (parsed.amount && !isNaN(parsed.amount))         result.amount = Math.abs(parseFloat(parsed.amount));
        if (parsed.type   === 'income' || parsed.type === 'expense') result.type = parsed.type;
      }
    } catch (parseErr) {
      console.error('JSON parse error in parse-transaction:', parseErr.message);
      // Fall back to keyword detection on the frontend side
    }

    res.json(result);
  } catch (err) {
    console.error('parse-transaction error:', err.message);
    // Return a safe fallback — never crash
    res.json({ text: req.body.text || '', amount: 0, type: 'expense' });
  }
});

// ─── /budget-warning ──────────────────────────────────────────────────────────
router.post('/budget-warning', auth, async (req, res) => {
  try {
    const { category, spent, limit } = req.body;
    const pct   = Math.round((spent / limit) * 100);
    const reply = await callAI(
      'Write ONE short budget overspend warning in 1-2 sentences. Start with ⚠️. Be specific with the numbers.',
      `Category: ${category}, Budget Limit: ₹${limit}, Amount Spent: ₹${spent}, Usage: ${pct}%`,
      100
    );
    res.json({ warning: reply || `⚠️ You've exceeded your ${category} budget!` });
  } catch (err) {
    console.error('budget-warning error:', err.message);
    res.json({ warning: `⚠️ You've exceeded your ${req.body.category} budget!` });
  }
});

// ─── /health-score ────────────────────────────────────────────────────────────
router.get('/health-score', auth, async (req, res) => {
  try {
    const ctx         = await getContext(req.user.id);
    const savingsRate = ctx.income > 0 ? ((ctx.income - ctx.expense) / ctx.income) * 100 : 0;
    const reply = await callAI(
      `You are a financial health scoring system. Analyze the user's finances and return ONLY a valid JSON object with exactly three fields:
- "score": integer from 0 to 100
- "grade": one of "A", "B", "C", "D", "F"
- "breakdown": 2-3 sentence explanation

Scoring guide:
- Savings rate >= 30%: score 80-100, grade A
- Savings rate 15-29%: score 60-79, grade B
- Savings rate 1-14%: score 40-59, grade C
- Spending equals income: score 20-39, grade D
- Spending exceeds income: score 0-19, grade F

Return ONLY the JSON object, nothing else.`,
      `Income: ₹${ctx.income.toFixed(0)}, Expenses: ₹${ctx.expense.toFixed(0)}, Balance: ₹${ctx.balance.toFixed(0)}, Savings Rate: ${savingsRate.toFixed(1)}%, Total Transactions: ${ctx.transactions.length}`,
      200
    );

    let result = { score: 50, breakdown: 'Keep tracking your expenses to improve your score.', grade: 'C' };
    try {
      const match = reply.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.score     !== undefined) result.score     = Math.min(100, Math.max(0, parseInt(parsed.score) || 50));
        if (parsed.breakdown !== undefined) result.breakdown = parsed.breakdown;
        if (parsed.grade     !== undefined) result.grade     = parsed.grade;
      }
    } catch {}
    res.json(result);
  } catch (err) {
    console.error('health-score error:', err.message);
    res.status(500).json({ score: 50, breakdown: 'Score unavailable right now.', grade: 'C' });
  }
});

// ─── /goal-advice ─────────────────────────────────────────────────────────────
router.post('/goal-advice', auth, async (req, res) => {
  try {
    const { goals }   = req.body;
    const ctx         = await getContext(req.user.id);
    const goalSummary = (goals || []).map(g => {
      const pct = Math.round((g.savedAmount / g.targetAmount) * 100);
      return `- ${g.title}: ₹${g.savedAmount}/₹${g.targetAmount} (${pct}% complete)${g.deadline ? ', deadline: ' + new Date(g.deadline).toDateString() : ''}`;
    }).join('\n');
    const reply = await callAI(
      'You are a financial goal coach. Give ONE short encouraging piece of advice about these savings goals. Max 2 sentences. Start with an emoji.',
      `Monthly savings available: ₹${(ctx.income - ctx.expense).toFixed(0)}\nGoals:\n${goalSummary || 'No goals set yet.'}`,
      120
    );
    res.json({ advice: reply || '🎯 Keep saving consistently — every rupee adds up!' });
  } catch (err) {
    console.error('goal-advice error:', err.message);
    res.json({ advice: '🎯 Keep saving consistently — every rupee adds up!' });
  }
});

// ─── /scan-receipt ────────────────────────────────────────────────────────────
router.post('/scan-receipt', auth, async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type':  'application/json',
        'HTTP-Referer':  'https://expense-tracker.vercel.app',
        'X-Title':       'Expense Tracker AI'
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Read this receipt/bill image. Return ONLY a valid JSON object: {"text":"2-5 word description","amount":total_as_number,"type":"expense"}' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image}` } }
          ]
        }],
        max_tokens: 100
      })
    });
    if (!response.ok) throw new Error(`Receipt scan API error: ${response.status}`);
    const data  = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';
    let result  = { text: 'Receipt', amount: 0, type: 'expense' };
    try {
      const match = reply.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed  = JSON.parse(match[0]);
        result.text   = parsed.text   || 'Receipt';
        result.amount = Math.abs(parseFloat(parsed.amount)) || 0;
        result.type   = 'expense';
      }
    } catch {}
    res.json(result);
  } catch (err) {
    console.error('scan-receipt error:', err.message);
    res.status(500).json({ text: 'Receipt', amount: 0, type: 'expense' });
  }
});

module.exports = router;
