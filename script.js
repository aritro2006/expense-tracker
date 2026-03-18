const API = 'https://expense-tracker-shck.onrender.com';

// ── cached data for chatbot ──────────────
let _cachedTransactions = [];

// ── AUTH GUARD ───────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (token) { showApp(); showPage('dashboard'); }
  else showAuth();
});

function showApp()  {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('app-section').style.display  = 'block';
}

function showAuth() {
  document.getElementById('auth-section').style.display = 'flex';
  document.getElementById('app-section').style.display  = 'none';
}

function showLogin()    {
  document.getElementById('login-form').style.display    = 'block';
  document.getElementById('register-form').style.display = 'none';
}

function showRegister() {
  document.getElementById('login-form').style.display    = 'none';
  document.getElementById('register-form').style.display = 'block';
}

// ── AUTH ─────────────────────────────────
async function login() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';
  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
  try {
    const res  = await fetch(`${API}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Login failed.'; return; }
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    showApp(); showPage('dashboard');
  } catch { errEl.textContent = 'Server error. Try again.'; }
}

async function register() {
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const errEl    = document.getElementById('register-error');
  errEl.textContent = '';
  if (!name || !email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }
  try {
    const res  = await fetch(`${API}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Registration failed.'; return; }
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    showApp(); showPage('dashboard');
  } catch { errEl.textContent = 'Server error. Try again.'; }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showAuth();
}

function getToken() { return localStorage.getItem('token'); }

async function apiFetch(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  if (res.status === 401) { logout(); return null; }
  return res.json();
}

// ── NAVIGATION ───────────────────────────
const pages = ['dashboard', 'transactions', 'budget', 'goals', 'recurring', 'profile'];

function showPage(name) {
  pages.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.style.display = p === name ? 'block' : 'none';
  });
  document.querySelectorAll('.nav-links button:not(.logout-btn)').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim().toLowerCase() === name.toLowerCase());
  });
  if (name === 'dashboard')    loadDashboard();
  if (name === 'transactions') loadTransactions();
  if (name === 'budget')       loadBudgets();
  if (name === 'goals')        loadGoals();
  if (name === 'recurring')    loadRecurring();
  if (name === 'profile')      loadProfile();
  document.getElementById('nav-links').classList.remove('open');
}

function toggleNav() {
  document.getElementById('nav-links').classList.toggle('open');
}

// ── DASHBOARD ────────────────────────────
async function loadDashboard() {
  const [transactions, scoreData, tipData, alertsData, budgets] = await Promise.all([
    apiFetch('/api/transactions'),
    apiFetch('/api/ai/health-score'),
    apiFetch('/api/ai/daily-tip'),
    apiFetch('/api/ai/alerts'),
    apiFetch('/api/budget')
  ]);

  if (transactions) {
    _cachedTransactions = transactions;
    const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;
    document.getElementById('dash-income').textContent  = `₹${income.toFixed(2)}`;
    document.getElementById('dash-expense').textContent = `₹${expense.toFixed(2)}`;
    document.getElementById('dash-balance').textContent = `₹${balance.toFixed(2)}`;
    document.getElementById('dash-balance').style.color = balance >= 0 ? '#4ade80' : '#f87171';

    const recent = transactions.slice(0, 5);
    const recentEl = document.getElementById('dash-recent');
    recentEl.innerHTML = recent.length === 0
      ? '<p class="empty">No transactions yet.</p>'
      : recent.map(t => `
          <div class="list-item">
            <div class="left">
              <span class="label">${t.category}</span>
              <span class="sub">${t.note || ''} · ${new Date(t.date).toLocaleDateString()}</span>
            </div>
            <span class="amount-${t.type}">${t.type === 'income' ? '+' : '-'}₹${t.amount.toFixed(2)}</span>
          </div>`).join('');
  }

  if (scoreData) {
    const s = scoreData.score;
    const el = document.getElementById('dash-score');
    el.textContent = s;
    el.style.color = s >= 70 ? '#4ade80' : s >= 40 ? '#facc15' : '#f87171';
  }

  if (tipData) document.getElementById('dash-tip').textContent = tipData.tip;

  if (alertsData && alertsData.alerts.length > 0) {
    document.getElementById('dash-alert').textContent = alertsData.alerts[0];
  }

  if (budgets && budgets.length > 0 && transactions) {
    const budEl = document.getElementById('dash-budget');
    budEl.innerHTML = budgets.map(b => {
      const spent = transactions
        .filter(t => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase())
        .reduce((s, t) => s + t.amount, 0);
      const pct = Math.min(100, Math.round((spent / b.limit) * 100));
      const color = pct >= 90 ? '#f87171' : pct >= 70 ? '#facc15' : '#4ade80';
      return `
        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="color:#fff">${b.category}</span>
            <span style="color:${color}">₹${spent.toFixed(0)} / ₹${b.limit}</span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar" style="width:${pct}%;background:${color}"></div>
          </div>
        </div>`;
    }).join('');
  } else {
    document.getElementById('dash-budget').innerHTML = '<p class="empty">No budgets set yet.</p>';
  }
}

// ── TRANSACTIONS ─────────────────────────
let allTransactions = [];

async function loadTransactions() {
  const list = await apiFetch('/api/transactions');
  if (!list) return;
  allTransactions = list;
  _cachedTransactions = list;
  renderTransactions(list);
}

function renderTransactions(list) {
  const el = document.getElementById('txn-list');
  if (!list || list.length === 0) { el.innerHTML = '<p class="empty">No transactions yet.</p>'; return; }
  el.innerHTML = list.map(t => `
    <div class="list-item">
      <div class="left">
        <span class="label">${t.category}</span>
        <span class="sub">${t.note || ''} · ${new Date(t.date).toLocaleDateString()}</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <span class="amount-${t.type}">${t.type === 'income' ? '+' : '-'}₹${t.amount.toFixed(2)}</span>
        <button class="del-btn" onclick="deleteTransaction('${t._id}')">Delete</button>
      </div>
    </div>`).join('');
}

function filterTransactions() {
  const q = document.getElementById('txn-search').value.toLowerCase();
  renderTransactions(allTransactions.filter(t =>
    t.category.toLowerCase().includes(q) ||
    (t.note || '').toLowerCase().includes(q)
  ));
}

async function addTransaction() {
  const type     = document.getElementById('txn-type').value;
  const amount   = parseFloat(document.getElementById('txn-amount').value);
  const category = document.getElementById('txn-category').value.trim();
  const note     = document.getElementById('txn-note').value.trim();
  const date     = document.getElementById('txn-date').value;
  const errEl    = document.getElementById('txn-error');
  errEl.textContent = '';
  if (!amount || !category) { errEl.textContent = 'Amount and category are required.'; return; }
  await apiFetch('/api/transactions', 'POST', { type, amount, category, note, date: date || new Date() });
  document.getElementById('txn-amount').value   = '';
  document.getElementById('txn-category').value = '';
  document.getElementById('txn-note').value     = '';
  document.getElementById('txn-date').value     = '';
  document.getElementById('txn-magic').value    = '';
  loadTransactions();
}

async function deleteTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  await apiFetch(`/api/transactions/${id}`, 'DELETE');
  loadTransactions();
}

// ── MAGIC WAND ────────────────────────────
function magicFill() {
  const text = document.getElementById('txn-magic').value.toLowerCase().trim();
  if (!text) { alert('Please type a description first!'); return; }

  // Extract amount
  const amountMatch = text.match(/\d+(\.\d+)?/);
  const amount = amountMatch ? parseFloat(amountMatch[0]) : '';

  // Detect type
  const incomeWords   = ['received', 'earned', 'got', 'salary', 'income', 'credited', 'payment received', 'freelance', 'bonus'];
  const expenseWords  = ['paid', 'spent', 'bought', 'purchased', 'order', 'bill', 'fee', 'charged', 'deducted'];
  let type = 'expense';
  if (incomeWords.some(w => text.includes(w))) type = 'income';
  else if (expenseWords.some(w => text.includes(w))) type = 'expense';

  // Detect category
  const categoryMap = [
    { keys: ['food', 'lunch', 'dinner', 'breakfast', 'restaurant', 'swiggy', 'zomato', 'groceries', 'grocery', 'vegetables', 'fruits', 'snack', 'cafe', 'coffee'], label: 'Food' },
    { keys: ['uber', 'ola', 'cab', 'auto', 'bus', 'metro', 'train', 'petrol', 'fuel', 'transport', 'travel', 'flight', 'ticket'], label: 'Transport' },
    { keys: ['netflix', 'spotify', 'amazon prime', 'hotstar', 'subscription', 'entertainment', 'movie', 'game'], label: 'Entertainment' },
    { keys: ['salary', 'stipend', 'wage', 'income', 'bonus', 'freelance'], label: 'Salary' },
    { keys: ['rent', 'mortgage', 'house', 'apartment', 'maintenance'], label: 'Rent' },
    { keys: ['electricity', 'water', 'wifi', 'internet', 'phone', 'mobile', 'recharge', 'utility', 'bill'], label: 'Utilities' },
    { keys: ['medicine', 'doctor', 'hospital', 'health', 'pharmacy', 'medical'], label: 'Health' },
    { keys: ['college', 'school', 'book', 'course', 'education', 'tuition', 'fees'], label: 'Education' },
    { keys: ['shopping', 'clothes', 'shirt', 'shoes', 'amazon', 'flipkart', 'myntra'], label: 'Shopping' },
    { keys: ['invest', 'mutual fund', 'stocks', 'sip', 'savings', 'fd'], label: 'Investment' },
  ];

  let category = '';
  for (const c of categoryMap) {
    if (c.keys.some(k => text.includes(k))) { category = c.label; break; }
  }
  if (!category) category = type === 'income' ? 'Income' : 'Expense';

  // Detect date
  let date = '';
  const today = new Date();
  if (text.includes('yesterday')) {
    const y = new Date(today); y.setDate(y.getDate() - 1);
    date = y.toISOString().split('T')[0];
  } else if (text.includes('today')) {
    date = today.toISOString().split('T')[0];
  } else if (text.includes('last week')) {
    const lw = new Date(today); lw.setDate(lw.getDate() - 7);
    date = lw.toISOString().split('T')[0];
  }

  // Fill form
  document.getElementById('txn-type').value     = type;
  document.getElementById('txn-amount').value   = amount;
  document.getElementById('txn-category').value = category;
  document.getElementById('txn-note').value     = document.getElementById('txn-magic').value;
  document.getElementById('txn-date').value     = date;

  // Flash effect
  const btn = document.querySelector('.magic-btn');
  btn.textContent = '✅';
  setTimeout(() => btn.textContent = '🪄', 1500);
}

// ── BUDGET ────────────────────────────────
async function loadBudgets() {
  const list = await apiFetch('/api/budget');
  const el   = document.getElementById('bud-list');
  if (!list || list.length === 0) { el.innerHTML = '<p class="empty">No budgets set yet.</p>'; return; }
  el.innerHTML = list.map(b => `
    <div class="list-item">
      <div class="left">
        <span class="label">${b.category}</span>
        <span class="sub">Month: ${b.month}</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <span style="color:#60a5fa;font-weight:bold">Limit: ₹${b.limit}</span>
        <button class="del-btn" onclick="deleteBudget('${b._id}')">Delete</button>
      </div>
    </div>`).join('');
}

async function addBudget() {
  const category = document.getElementById('bud-category').value.trim();
  const limit    = parseFloat(document.getElementById('bud-limit').value);
  const month    = document.getElementById('bud-month').value;
  const errEl    = document.getElementById('bud-error');
  errEl.textContent = '';
  if (!category || !limit || !month) { errEl.textContent = 'All fields are required.'; return; }
  await apiFetch('/api/budget', 'POST', { category, limit, month });
  document.getElementById('bud-category').value = '';
  document.getElementById('bud-limit').value    = '';
  document.getElementById('bud-month').value    = '';
  loadBudgets();
}

async function deleteBudget(id) {
  if (!confirm('Delete this budget?')) return;
  await apiFetch(`/api/budget/${id}`, 'DELETE');
  loadBudgets();
}

// ── GOALS ─────────────────────────────────
async function loadGoals() {
  const list = await apiFetch('/api/goals');
  const el   = document.getElementById('goal-list');
  if (!list || list.length === 0) { el.innerHTML = '<p class="empty">No goals yet.</p>'; return; }
  el.innerHTML = list.map(g => {
    const pct = Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100));
    return `
      <div class="section-box" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div class="label">${g.title}</div>
            <div class="sub">₹${g.savedAmount} of ₹${g.targetAmount} · ${pct}%${g.deadline ? ' · Due: ' + new Date(g.deadline).toLocaleDateString() : ''}</div>
          </div>
          <button class="del-btn" onclick="deleteGoal('${g._id}')">Delete</button>
        </div>
        <div class="progress-bar-wrap" style="margin-top:10px">
          <div class="progress-bar" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

async function addGoal() {
  const title        = document.getElementById('goal-title').value.trim();
  const targetAmount = parseFloat(document.getElementById('goal-target').value);
  const savedAmount  = parseFloat(document.getElementById('goal-saved').value) || 0;
  const deadline     = document.getElementById('goal-deadline').value;
  const errEl        = document.getElementById('goal-error');
  errEl.textContent  = '';
  if (!title || !targetAmount) { errEl.textContent = 'Title and target amount are required.'; return; }
  await apiFetch('/api/goals', 'POST', { title, targetAmount, savedAmount, deadline: deadline || undefined });
  document.getElementById('goal-title').value    = '';
  document.getElementById('goal-target').value   = '';
  document.getElementById('goal-saved').value    = '';
  document.getElementById('goal-deadline').value = '';
  loadGoals();
}

async function deleteGoal(id) {
  if (!confirm('Delete this goal?')) return;
  await apiFetch(`/api/goals/${id}`, 'DELETE');
  loadGoals();
}

// ── RECURRING ─────────────────────────────
async function loadRecurring() {
  const list = await apiFetch('/api/recurring');
  const el   = document.getElementById('rec-list');
  if (!list || list.length === 0) { el.innerHTML = '<p class="empty">No recurring transactions yet.</p>'; return; }
  el.innerHTML = list.map(r => `
    <div class="list-item">
      <div class="left">
        <span class="label">${r.title}</span>
        <span class="sub">${r.category} · ${r.frequency}${r.nextDate ? ' · Next: ' + new Date(r.nextDate).toLocaleDateString() : ''}</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <span style="color:#f87171;font-weight:bold">₹${r.amount}</span>
        <button class="del-btn" onclick="deleteRecurring('${r._id}')">Delete</button>
      </div>
    </div>`).join('');
}

async function addRecurring() {
  const title     = document.getElementById('rec-title').value.trim();
  const amount    = parseFloat(document.getElementById('rec-amount').value);
  const category  = document.getElementById('rec-category').value.trim();
  const frequency = document.getElementById('rec-frequency').value;
  const nextDate  = document.getElementById('rec-nextdate').value;
  const errEl     = document.getElementById('rec-error');
  errEl.textContent = '';
  if (!title || !amount || !category) { errEl.textContent = 'Title, amount, and category are required.'; return; }
  await apiFetch('/api/recurring', 'POST', { title, amount, category, frequency, nextDate: nextDate || undefined });
  document.getElementById('rec-title').value    = '';
  document.getElementById('rec-amount').value   = '';
  document.getElementById('rec-category').value = '';
  document.getElementById('rec-nextdate').value = '';
  loadRecurring();
}

async function deleteRecurring(id) {
  if (!confirm('Delete this recurring item?')) return;
  await apiFetch(`/api/recurring/${id}`, 'DELETE');
  loadRecurring();
}

// ── PROFILE ───────────────────────────────
async function loadProfile() {
  const data = await apiFetch('/api/profile');
  if (!data) return;
  document.getElementById('prof-name').value  = data.name  || '';
  document.getElementById('prof-email').value = data.email || '';
}

async function updateProfile() {
  const name  = document.getElementById('prof-name').value.trim();
  const msgEl = document.getElementById('prof-msg');
  msgEl.textContent = '';
  if (!name) { msgEl.style.color = '#f87171'; msgEl.textContent = 'Name cannot be empty.'; return; }
  const data = await apiFetch('/api/profile', 'PUT', { name });
  if (data) {
    localStorage.setItem('user', JSON.stringify(data));
    msgEl.style.color = '#4ade80';
    msgEl.textContent = '✅ Profile updated!';
  }
}

// ── FLOATING CHATBOT ─────────────────────
function toggleChat() {
  document.getElementById('chat-panel').classList.toggle('open');
}

function quickAsk(msg) {
  document.getElementById('chat-input').value = msg;
  sendChat();
}

async function sendChat() {
  const input   = document.getElementById('chat-input');
  const msg     = input.value.trim();
  if (!msg) return;
  input.value = '';

  const messagesEl = document.getElementById('chat-messages');
  messagesEl.innerHTML += `<div class="chat-msg user">${msg}</div>`;

  const reply = await getBotReply(msg.toLowerCase());
  messagesEl.innerHTML += `<div class="chat-msg bot">${reply}</div>`;
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function getBotReply(msg) {
  // Greetings
  if (/^(hi|hello|hey|sup)/.test(msg)) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return `👋 Hey ${user.name || 'there'}! How can I help you with your finances today?`;
  }

  // Balance
  if (msg.includes('balance') || msg.includes('how much do i have')) {
    const txns = _cachedTransactions.length ? _cachedTransactions : await apiFetch('/api/transactions') || [];
    _cachedTransactions = txns;
    const income  = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = income - expense;
    return `💰 Your current balance is <strong>₹${balance.toFixed(2)}</strong><br>Income: ₹${income.toFixed(2)} | Expenses: ₹${expense.toFixed(2)}`;
  }

  // Health score
  if (msg.includes('health') || msg.includes('score') || msg.includes('how am i doing')) {
    const data = await apiFetch('/api/ai/health-score');
    if (!data) return '❌ Could not fetch score right now.';
    const s = data.score;
    const label = s >= 70 ? '🟢 Great' : s >= 40 ? '🟡 Moderate' : '🔴 Needs improvement';
    return `📊 Your financial health score is <strong>${s}/100</strong> — ${label}`;
  }

  // Tip
  if (msg.includes('tip') || msg.includes('advice') || msg.includes('suggest')) {
    const data = await apiFetch('/api/ai/daily-tip');
    return data ? `💡 ${data.tip}` : '❌ Could not fetch a tip right now.';
  }

  // Summary
  if (msg.includes('summary') || msg.includes('this week') || msg.includes('overview')) {
    const data = await apiFetch('/api/ai/weekly-summary');
    if (!data) return '❌ Could not fetch summary.';
    return `📈 Summary:<br>💰 Income: ₹${data.income.toFixed(2)}<br>💸 Expenses: ₹${data.expense.toFixed(2)}<br>🏦 Balance: ₹${data.balance.toFixed(2)}`;
  }

  // Top expense
  if (msg.includes('top') || msg.includes('most') || msg.includes('biggest')) {
    const txns = _cachedTransactions.length ? _cachedTransactions : await apiFetch('/api/transactions') || [];
    const expenses = txns.filter(t => t.type === 'expense');
    if (expenses.length === 0) return '📭 No expenses recorded yet.';
    const top = expenses.sort((a, b) => b.amount - a.amount)[0];
    return `💸 Your biggest expense is <strong>₹${top.amount.toFixed(2)}</strong> on <strong>${top.category}</strong>${top.note ? ' (' + top.note + ')' : ''}`;
  }

  // Total transactions
  if (msg.includes('how many') || msg.includes('transactions')) {
    const txns = _cachedTransactions.length ? _cachedTransactions : await apiFetch('/api/transactions') || [];
    return `📋 You have <strong>${txns.length}</strong> transaction${txns.length !== 1 ? 's' : ''} recorded.`;
  }

  // Help
  if (msg.includes('help') || msg.includes('what can you do')) {
    return `🤖 I can help you with:<br>• <em>balance</em> — your current balance<br>• <em>health score</em> — financial health<br>• <em>tip</em> — a financial tip<br>• <em>summary</em> — income & expense overview<br>• <em>biggest expense</em> — your top expense`;
  }

  return `🤔 I didn't quite get that. Try asking about your <em>balance</em>, <em>health score</em>, or say <em>help</em> to see what I can do!`;
}
