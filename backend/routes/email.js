const express     = require('express');
const router      = express.Router();
const nodemailer  = require('nodemailer');
const auth        = require('../middleware/authMiddleware');
const User        = require('../models/User');
const Transaction = require('../models/Transaction');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const buildWeeklySummaryHTML = (name, recipientEmail, income, expense, balance, topCats, transactions) => {
  const now       = new Date();
  const catEmojis = {
    Food:'🍔', Transport:'🚗', Shopping:'🛍️', Entertainment:'🎬',
    Health:'💊', Education:'📚', Utilities:'💡', Other:'📦',
    Salary:'💰', Business:'💼'
  };

  const txRows = transactions.slice(0, 10).map(t => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a45;">${t.emoji || (t.amount > 0 ? '💰' : '💸')} ${t.text}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a45;">${t.category || 'Other'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a45;color:${t.amount > 0 ? '#10b981' : '#ef4444'};font-weight:600;">
        ${t.amount > 0 ? '+' : '-'}₹${Math.abs(t.amount).toFixed(2)}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a45;color:#94a3b8;font-size:12px;">
        ${new Date(t.date).toLocaleDateString('en-IN')}
      </td>
    </tr>`).join('');

  const topCatsHTML = topCats.map(([cat, amt]) => `
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #2a2a45;">
      <span style="color:#e2e8f0;">${catEmojis[cat] || '📦'} ${cat}</span>
      <span style="color:#ef4444;font-weight:600;">₹${amt.toFixed(2)}</span>
    </div>`).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:Inter,Arial,sans-serif;color:#e2e8f0;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:16px;padding:32px;text-align:center;margin-bottom:24px;">
    <div style="font-size:40px;margin-bottom:8px;">💰</div>
    <h1 style="margin:0;font-size:24px;color:white;font-weight:700;">Weekly Finance Summary</h1>
    <p style="margin:10px 0 0;color:rgba(255,255,255,0.85);font-size:15px;">Hi ${name}! Here's your week at a glance 👋</p>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.6);font-size:12px;">
      ${now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
    </p>
  </div>

  <!-- Stats Row -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <tr>
      <td width="33%" style="padding-right:6px;">
        <div style="background:#1e1e35;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px;text-align:center;">
          <div style="color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:1px;margin-bottom:6px;">INCOME</div>
          <div style="color:#10b981;font-size:22px;font-weight:700;">+₹${income.toFixed(0)}</div>
        </div>
      </td>
      <td width="33%" style="padding:0 3px;">
        <div style="background:#1e1e35;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px;text-align:center;">
          <div style="color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:1px;margin-bottom:6px;">EXPENSES</div>
          <div style="color:#ef4444;font-size:22px;font-weight:700;">-₹${expense.toFixed(0)}</div>
        </div>
      </td>
      <td width="33%" style="padding-left:6px;">
        <div style="background:#1e1e35;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:18px;text-align:center;">
          <div style="color:#94a3b8;font-size:11px;font-weight:600;letter-spacing:1px;margin-bottom:6px;">NET SAVED</div>
          <div style="color:${balance >= 0 ? '#10b981' : '#ef4444'};font-size:22px;font-weight:700;">
            ${balance >= 0 ? '+' : '-'}₹${Math.abs(balance).toFixed(0)}
          </div>
        </div>
      </td>
    </tr>
  </table>

  ${topCats.length ? `
  <!-- Top Categories -->
  <div style="background:#1e1e35;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px;">
    <h3 style="margin:0 0 14px;font-size:14px;color:#a855f7;font-weight:600;">📊 Top Spending Categories This Week</h3>
    ${topCatsHTML}
  </div>` : ''}

  ${transactions.length ? `
  <!-- Recent Transactions -->
  <div style="background:#1e1e35;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px;overflow:hidden;">
    <h3 style="margin:0 0 14px;font-size:14px;color:#a855f7;font-weight:600;">📋 Transactions This Week</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;padding:8px 12px;color:#64748b;font-weight:500;border-bottom:1px solid #2a2a45;">Description</th>
          <th style="text-align:left;padding:8px 12px;color:#64748b;font-weight:500;border-bottom:1px solid #2a2a45;">Category</th>
          <th style="text-align:left;padding:8px 12px;color:#64748b;font-weight:500;border-bottom:1px solid #2a2a45;">Amount</th>
          <th style="text-align:left;padding:8px 12px;color:#64748b;font-weight:500;border-bottom:1px solid #2a2a45;">Date</th>
        </tr>
      </thead>
      <tbody>${txRows}</tbody>
    </table>
  </div>` : ''}

  <!-- Savings Rate Banner -->
  ${income > 0 ? `
  <div style="background:${balance >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};border:1px solid ${balance >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};border-radius:12px;padding:16px;text-align:center;margin-bottom:24px;">
    <p style="margin:0;font-size:14px;color:${balance >= 0 ? '#10b981' : '#ef4444'};">
      ${balance >= 0
        ? `✅ Great job! You saved <strong>${((balance / income) * 100).toFixed(1)}%</strong> of your income this week.`
        : `⚠️ You spent more than you earned this week. Try to cut back on expenses.`}
    </p>
  </div>` : ''}

  <!-- Footer -->
  <div style="text-align:center;color:#475569;font-size:12px;padding-top:8px;line-height:1.8;">
    <p>This summary was sent to <strong style="color:#7c3aed;">${recipientEmail}</strong> because you enabled weekly summaries.</p>
    <p>Built with ❤️ by <strong style="color:#a855f7;">Smart Expense Tracker</strong></p>
  </div>

</div>
</body>
</html>`;
};

const sendWeeklySummaryEmail = async (userId, recipientEmail, name) => {
  const now     = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const transactions = await Transaction.find({
    user: userId,
    date: { $gte: weekAgo }
  }).sort({ date: -1 });

  if (!transactions.length) return { skipped: true };

  const income  = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const balance = income - expense;

  const catMap = {};
  transactions.filter(t => t.amount < 0).forEach(t => {
    const k = t.category || 'Other';
    catMap[k] = (catMap[k] || 0) + Math.abs(t.amount);
  });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const html = buildWeeklySummaryHTML(name, recipientEmail, income, expense, balance, topCats, transactions);

  await transporter.sendMail({
    from:    `"Smart Expense Tracker" <${process.env.EMAIL_USER}>`,
    to:      recipientEmail,
    subject: `📊 Your Weekly Finance Summary — ${now.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`,
    html
  });

  return { sent: true, to: recipientEmail };
};

// Manual send from Profile page
router.post('/send-weekly', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.emailNotifications)
      return res.status(400).json({ message: 'Email notifications are disabled. Enable them in your profile.' });

    const result = await sendWeeklySummaryEmail(user._id, user.email, user.name);

    if (result.skipped)
      return res.json({ message: 'No transactions this week to summarize.' });

    res.json({ message: `✅ Summary sent to ${user.email}` });
  } catch (err) {
    console.error('Email send error:', err.message);
    res.status(500).json({ message: 'Failed to send email. Check server config.' });
  }
});

// Test email
router.post('/test', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    await transporter.sendMail({
      from:    `"Smart Expense Tracker" <${process.env.EMAIL_USER}>`,
      to:      user.email,
      subject: '✅ Email Notifications Active — Smart Expense Tracker',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:Inter,Arial,sans-serif;">
<div style="max-width:480px;margin:40px auto;padding:40px;background:#1e1e35;border:1px solid rgba(255,255,255,0.08);border-radius:16px;text-align:center;">
  <div style="font-size:48px;margin-bottom:16px;">✅</div>
  <h2 style="color:#a855f7;margin:0 0 12px;">Email notifications are working!</h2>
  <p style="color:#94a3b8;margin:0 0 8px;">Hi <strong style="color:#e2e8f0;">${user.name}</strong>,</p>
  <p style="color:#94a3b8;margin:0 0 16px;">Weekly finance summaries will be delivered to:</p>
  <p style="font-size:18px;font-weight:700;color:#7c3aed;background:rgba(124,58,237,0.1);padding:12px;border-radius:8px;margin:0 0 16px;">${user.email}</p>
  <p style="color:#94a3b8;margin:0 0 24px;">Every <strong style="color:#e2e8f0;">Sunday at 9 AM</strong>, you'll receive a full breakdown of your week's income, expenses, and savings.</p>
  <hr style="border:none;border-top:1px solid #2a2a45;margin:0 0 16px;"/>
  <p style="color:#475569;font-size:12px;margin:0;">Smart Expense Tracker — AI-powered finance management</p>
</div>
</body>
</html>`
    });

    res.json({ message: `✅ Test email sent to ${user.email}` });
  } catch (err) {
    console.error('Test email error:', err.message);
    res.status(500).json({ message: 'Failed to send test email. Check EMAIL_USER and EMAIL_PASS in .env' });
  }
});

module.exports = router;
module.exports.sendWeeklySummaryEmail = sendWeeklySummaryEmail;
