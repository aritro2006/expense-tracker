const express     = require('express');
const router      = express.Router();
const nodemailer  = require('nodemailer');
const auth        = require('../middleware/authMiddleware');
const User        = require('../models/User');
const Transaction = require('../models/Transaction');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const sendWeeklySummaryEmail = async (userId, email, name) => {
  const now    = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const transactions = await Transaction.find({
    user: userId, date: { $gte: weekAgo }
  }).sort({ date: -1 });

  if (!transactions.length) return;

  const income  = transactions.filter(t => t.amount > 0).reduce((s,t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.amount < 0).reduce((s,t) => s + Math.abs(t.amount), 0);
  const balance = income - expense;

  const catMap = {};
  transactions.filter(t => t.amount < 0).forEach(t => {
    const k = t.category || 'Other';
    catMap[k] = (catMap[k] || 0) + Math.abs(t.amount);
  });
  const topCats = Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0,3);

  const txRows = transactions.slice(0,10).map(t => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a45;">${t.emoji || (t.amount>0?'💰':'💸')} ${t.text}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a45;">${t.category||'Other'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a45;color:${t.amount>0?'#10b981':'#ef4444'};font-weight:600;">
        ${t.amount>0?'+':'-'}₹${Math.abs(t.amount).toFixed(2)}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #2a2a45;color:#94a3b8;font-size:12px;">
        ${new Date(t.date).toLocaleDateString('en-IN')}
      </td>
    </tr>`).join('');

  const topCatsHTML = topCats.map(([cat,amt]) => `
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #2a2a45;">
      <span style="color:#e2e8f0;">${cat}</span>
      <span style="color:#ef4444;font-weight:600;">₹${amt.toFixed(2)}</span>
    </div>`).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#0f0f1a;font-family:Inter,Arial,sans-serif;color:#e2e8f0;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);border-radius:16px;padding:28px;text-align:center;margin-bottom:24px;">
      <div style="font-size:32px;margin-bottom:8px;">💰</div>
      <h1 style="margin:0;font-size:22px;color:white;font-weight:700;">Weekly Finance Summary</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Hi ${name}! Here's your week at a glance 👋</p>
    </div>

    <!-- Stats -->
    <div style="display:grid;gap:12px;margin-bottom:24px;">
      <div style="display:flex;gap:12px;">
        <div style="flex:1;background:#1e1e35;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;text-align:center;">
          <div style="color:#94a3b8;font-size:12px;margin-bottom:4px;">INCOME</div>
          <div style="color:#10b981;font-size:20px;font-weight:700;">+₹${income.toFixed(2)}</div>
        </div>
        <div style="flex:1;background:#1e1e35;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;text-align:center;">
          <div style="color:#94a3b8;font-size:12px;margin-bottom:4px;">EXPENSES</div>
          <div style="color:#ef4444;font-size:20px;font-weight:700;">-₹${expense.toFixed(2)}</div>
        </div>
        <div style="flex:1;background:#1e1e35;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;text-align:center;">
          <div style="color:#94a3b8;font-size:12px;margin-bottom:4px;">NET</div>
          <div style="color:${balance>=0?'#10b981':'#ef4444'};font-size:20px;font-weight:700;">${balance>=0?'+':'-'}₹${Math.abs(balance).toFixed(2)}</div>
        </div>
      </div>
    </div>

    ${topCats.length ? `
    <!-- Top Categories -->
    <div style="background:#1e1e35;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#a855f7;">📊 Top Spending Categories</h3>
      ${topCatsHTML}
    </div>` : ''}

    ${transactions.length ? `
    <!-- Recent Transactions -->
    <div style="background:#1e1e35;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px;overflow:hidden;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#a855f7;">📋 Recent Transactions</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="color:#94a3b8;">
            <th style="text-align:left;padding:8px 12px;">Description</th>
            <th style="text-align:left;padding:8px 12px;">Category</th>
            <th style="text-align:left;padding:8px 12px;">Amount</th>
            <th style="text-align:left;padding:8px 12px;">Date</th>
          </tr>
        </thead>
        <tbody>${txRows}</tbody>
      </table>
    </div>` : ''}

    <!-- Footer -->
    <div style="text-align:center;color:#64748b;font-size:12px;padding-top:16px;">
      <p>You're receiving this because you have weekly summaries enabled.</p>
      <p>Log in to your <strong style="color:#a855f7;">Smart Expense Tracker</strong> to manage your finances.</p>
    </div>

  </div>
</body>
</html>`;

  await transporter.sendMail({
    from:    `"Smart Expense Tracker" <${process.env.EMAIL_USER}>`,
    to:      email,
    subject: `📊 Your Weekly Finance Summary — ${now.toLocaleDateString('en-IN', { day:'numeric', month:'short' })}`,
    html
  });
};

router.post('/send-weekly', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.emailNotifications)
      return res.status(400).json({ message: 'Email notifications are disabled' });
    await sendWeeklySummaryEmail(user._id, user.email, user.name);
    res.json({ message: 'Weekly summary sent to ' + user.email });
  } catch (err) {
    console.error('Email send error:', err);
    res.status(500).json({ message: 'Failed to send email' });
  }
});

router.post('/test', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    await transporter.sendMail({
      from:    `"Smart Expense Tracker" <${process.env.EMAIL_USER}>`,
      to:      user.email,
      subject: '✅ Email Notifications Active — Smart Expense Tracker',
      html:    `<div style="font-family:Arial;padding:32px;background:#0f0f1a;color:#e2e8f0;">
                  <h2 style="color:#a855f7;">✅ Email notifications are working!</h2>
                  <p>Hi ${user.name}, your weekly summaries will be sent every Sunday at 9 AM.</p>
                </div>`
    });
    res.json({ message: 'Test email sent to ' + user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to send test email' });
  }
});

module.exports = router;
module.exports.sendWeeklySummaryEmail = sendWeeklySummaryEmail;
