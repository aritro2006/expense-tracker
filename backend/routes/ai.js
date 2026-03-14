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
      max_tokens: maxTokens, temperature: 0.1
    })
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Could not process request.';
};

const getContext = async (userId) => {
  const transactions = await Transaction.find({ user: userId });
  const income  = transactions.filter(t => t.amount > 0).reduce((s,t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.amount < 0).reduce((s,t) => s + Math.abs(t.amount), 0);
  const list    = transactions.slice(-30).map(t =>
    `- ${t.text}: ₹${Math.abs(t.amount)} (${t.amount>0?'income':'expense'}) on ${new Date(t.date).toDateString()}`
  ).join('\n');
  return { transactions, income, expense, balance: income - expense, list };
};

router.post('/analyze', auth, async (req, res) => {
  try {
    const ctx   = await getContext(req.user.id);
    const reply = await callAI(
      'You are a smart personal finance assistant. Give helpful, friendly, specific financial advice using bullet points. Use ₹.',
      `Transactions:\n${ctx.list}\nIncome: ₹${ctx.income}, Expenses: ₹${ctx.expense}, Balance: ₹${ctx.balance}\n\n${req.body.message}`
    );
    res.json({ reply });
  } catch { res.status(500).json({ reply: 'Server error during analysis.' }); }
});

router.post('/chat', auth, async (req, res) => {
  try {
    const ctx   = await getContext(req.user.id);
    const reply = await callAI(
      `You are a personal finance assistant. User data:\n${ctx.list}\nIncome: ₹${ctx.income}, Expenses: ₹${ctx.expense}, Balance: ₹${ctx.balance}\nAnswer concisely. Use ₹.`,
      req.body.message, 300
    );
    res.json({ reply });
  } catch { res.status(500).json({ reply: 'Server error.' }); }
});

router.get('/monthly-report', auth, async (req, res) => {
  try {
    const ctx   = await getContext(req.user.id);
    const now   = new Date();
    const mTx   = ctx.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const mInc  = mTx.filter(t => t.amount > 0).reduce((s,t) => s + t.amount, 0);
    const mExp  = mTx.filter(t => t.amount < 0).reduce((s,t) => s + Math.abs(t.amount), 0);
    const mList = mTx.map(t => `- ${t.text}: ₹${Math.abs(t.amount)} (${t.amount>0?'income':'expense'})`).join('\n');
    const reply = await callAI(
      'You are a financial report generator. Write a detailed, friendly monthly report in 4-5 sentences. Mention income, expenses, savings rate, biggest expense, and one key recommendation. Use ₹.',
      `Month: ${now.toLocaleString('default',{month:'long',year:'numeric'})}\n${mList||'No transactions.'}\nIncome: ₹${mInc}, Expenses: ₹${mExp}, Saved: ₹${mInc-mExp}`, 400
    );
    res.json({ reply, stats: { income: mInc, expense: mExp, saved: mInc - mExp, count: mTx.length } });
  } catch { res.status(500).json({ reply: 'Server error.' }); }
});

router.get('/predict', auth, async (req, res) => {
  try {
    const ctx   = await getContext(req.user.id);
    const reply = await callAI(
      'You are a financial prediction AI. Predict next month expenses in 2-3 sentences. Give a specific ₹ figure and reasoning.',
      `Recent transactions:\n${ctx.list}\nTotal expenses: ₹${ctx.expense}`, 200
    );
    res.json({ reply });
  } catch { res.status(500).json({ reply: 'Prediction unavailable.' }); }
});

router.get('/alerts', auth, async (req, res) => {
  try {
    const ctx     = await getContext(req.user.id);
    const now     = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const weekExp = ctx.transactions
      .filter(t => new Date(t.date) >= weekAgo && t.amount < 0)
      .reduce((s,t) => s + Math.abs(t.amount), 0);
    const budgets    = await Budget.find({ user: req.user.id, month: now.getMonth(), year: now.getFullYear() });
    const monthTx    = ctx.transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear() && t.amount<0;
    });
    const overspent = budgets.map(b => {
      const spent = monthTx.filter(t => t.category===b.category).reduce((s,t) => s + Math.abs(t.amount), 0);
      return spent > b.limit ? `${b.category} (₹${spent}/₹${b.limit})` : null;
    }).filter(Boolean);
    const reply = await callAI(
      'You are a financial alert system. Return a JSON array of 2-4 alerts with fields: type (warning/info/success), message (max 14 words). Only valid JSON array.',
      `Balance: ₹${ctx.balance}, Income: ₹${ctx.income}, Expenses: ₹${ctx.expense}, Week: ₹${weekExp}${overspent.length?'\nOVERSPENT: '+overspent.join(', '):''}`, 200
    );
    let alerts = [];
    try { alerts = JSON.parse(reply.match(/\[[\s\S]*\]/)?.[0] || '[]'); }
    catch { alerts = [{ type:'info', message:'Keep tracking your expenses!' }]; }
    res.json({ alerts });
  } catch { res.status(500).json({ alerts: [] }); }
});

router.post('/categorize', auth, async (req, res) => {
  try {
    const { text } = req.body;
    const reply = await callAI(
      'You are a transaction categorizer. Return ONLY a JSON object with "category" (one of: Food, Transport, Shopping, Entertainment, Health, Education, Salary, Business, Utilities, Other) and "emoji" (one relevant emoji). Just JSON.',
      `Transaction: "${text}"`, 60
    );
    let result = { category: 'Other', emoji: '💰' };
    try { result = JSON.parse(reply.match(/\{[\s\S]*\}/)?.[0] || '{}'); } catch {}
    res.json(result);
  } catch { res.json({ category: 'Other', emoji: '💰' }); }
});

router.get('/weekly-summary', auth, async (req, res) => {
  try {
    const ctx   = await getContext(req.user.id);
    const now   = new Date();
    const wk1   = new Date(now - 7  * 86400000);
    const wk2   = new Date(now - 14 * 86400000);
    const thisE = ctx.transactions.filter(t => new Date(t.date)>=wk1 && t.amount<0).reduce((s,t) => s+Math.abs(t.amount), 0);
    const lastE = ctx.transactions.filter(t => new Date(t.date)>=wk2 && new Date(t.date)<wk1 && t.amount<0).reduce((s,t) => s+Math.abs(t.amount), 0);
    const diff  = thisE - lastE;
    res.json({ summary: `This week: ₹${thisE.toFixed(0)} spent, ₹${Math.abs(diff).toFixed(0)} ${diff>0?'more':'less'} than last week ${diff>0?'📈':'📉'}` });
  } catch { res.status(500).json({ summary: 'Weekly data unavailable.' }); }
});

router.get('/daily-tip', auth, async (req, res) => {
  try {
    const ctx   = await getContext(req.user.id);
    const reply = await callAI(
      'Give ONE short, practical personalized money-saving tip in 1-2 sentences. Start with an emoji.',
      `Balance: ₹${ctx.balance}, Income: ₹${ctx.income}, Expenses: ₹${ctx.expense}`, 80
    );
    res.json({ tip: reply });
  } catch { res.json({ tip: '💡 Track every expense, no matter how small!' }); }
});

router.post('/parse-transaction', auth, async (req, res) => {
  try {
    const { text } = req.body;
    const reply = await callAI(
      `You are a financial transaction classifier. Extract structured data from natural language input.
RULES:
1. "type" = "income"  → got, received, earned, salary, bonus, pocket money, allowance, stipend, refund, cashback, gift, prize, credit, deposited, scholarship, commission
2. "type" = "expense" → bought, paid, spent, bill, fee, rent, food, travel, subscription, recharge, emi
3. "amount" = positive number from the text
4. "text" = clean 2-5 word description
5. Return ONLY valid JSON, nothing else
EXAMPLES:
"got 2000 as pocket money"   → {"text":"Pocket Money","amount":2000,"type":"income"}
"spent 150 on lunch today"   → {"text":"Lunch","amount":150,"type":"expense"}
"received 5000 salary"       → {"text":"Salary","amount":5000,"type":"income"}
"paid 800 electricity bill"  → {"text":"Electricity Bill","amount":800,"type":"expense"}`,
      `Input: "${text}"`, 120
    );
    let result = { text, amount: 0, type: 'expense' };
    try {
      const match = reply.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed  = JSON.parse(match[0]);
        result.text   = parsed.text   || text;
        result.amount = Math.abs(parseFloat(parsed.amount)) || 0;
        result.type   = parsed.type === 'income' ? 'income' : 'expense';
      }
    } catch {}
    res.json(result);
  } catch { res.status(500).json({ text: req.body.text, amount: 0, type: 'expense' }); }
});

router.post('/budget-warning', auth, async (req, res) => {
  try {
    const { category, spent, limit } = req.body;
    const pct   = Math.round((spent / limit) * 100);
    const reply = await callAI(
      'Write ONE short overspend warning in 1-2 sentences. Start with ⚠️. Be specific with numbers.',
      `Category: ${category}, Limit: ₹${limit}, Spent: ₹${spent}, Used: ${pct}%`, 80
    );
    res.json({ warning: reply });
  } catch { res.json({ warning: `⚠️ You've exceeded your ${req.body.category} budget!` }); }
});

router.get('/health-score', auth, async (req, res) => {
  try {
    const ctx         = await getContext(req.user.id);
    const savingsRate = ctx.income > 0 ? ((ctx.income - ctx.expense) / ctx.income) * 100 : 0;
    const reply = await callAI(
      `You are a financial health scoring system. Return ONLY a valid JSON object: {"score": number_0_to_100, "breakdown": "2-3 sentence explanation", "grade": "A/B/C/D/F"}
Scoring: Savings rate ≥30%: 80-100 (A), 15-30%: 60-79 (B), 0-15%: 40-59 (C), Spending>income: 0-39 (D/F)`,
      `Income: ₹${ctx.income}, Expenses: ₹${ctx.expense}, Balance: ₹${ctx.balance}, Savings Rate: ${savingsRate.toFixed(1)}%, Transactions: ${ctx.transactions.length}`, 150
    );
    let result = { score: 50, breakdown: 'Keep tracking to improve your score.', grade: 'C' };
    try {
      const match = reply.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed     = JSON.parse(match[0]);
        result.score     = Math.min(100, Math.max(0, parseInt(parsed.score) || 50));
        result.breakdown = parsed.breakdown || result.breakdown;
        result.grade     = parsed.grade     || result.grade;
      }
    } catch {}
    res.json(result);
  } catch { res.status(500).json({ score: 50, breakdown: 'Score unavailable.', grade: 'C' }); }
});

router.post('/goal-advice', auth, async (req, res) => {
  try {
    const { goals }     = req.body;
    const ctx           = await getContext(req.user.id);
    const goalSummary   = (goals||[]).map(g => {
      const pct = Math.round((g.savedAmount / g.targetAmount) * 100);
      return `- ${g.title}: ₹${g.savedAmount}/₹${g.targetAmount} (${pct}%)${g.deadline?', deadline: '+new Date(g.deadline).toDateString():''}`;
    }).join('\n');
    const reply = await callAI(
      'You are a financial goal coach. Give ONE short encouraging piece of advice about these goals. Max 2 sentences. Start with an emoji.',
      `Monthly savings available: ₹${(ctx.income-ctx.expense).toFixed(0)}\nGoals:\n${goalSummary||'No goals set yet.'}`, 100
    );
    res.json({ advice: reply });
  } catch { res.json({ advice: '🎯 Keep saving consistently — small amounts add up fast!' }); }
});

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
            { type: 'text', text: 'Read this receipt/bill image. Return ONLY a valid JSON: {"text":"2-5 word description","amount":total_as_number,"type":"expense"}' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image}` } }
          ]
        }],
        max_tokens: 100
      })
    });
    const data  = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';
    let result  = { text: 'Receipt', amount: 0, type: 'expense' };
    try {
      const match = reply.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed  = JSON.parse(match[0]);
        result.text   = parsed.text   || 'Receipt';
        result.amount = Math.abs(parseFloat(parsed.amount)) || 0;
      }
    } catch {}
    res.json(result);
  } catch { res.status(500).json({ text: 'Receipt', amount: 0, type: 'expense' }); }
});

module.exports = router;
