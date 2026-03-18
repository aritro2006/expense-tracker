const API = 'https://expense-tracker-shck.onrender.com';

// ─── AUTH GUARD ───────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (token) {
    showApp();
    showPage('dashboard');
  } else {
    showAuth();
  }
});

function showApp() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('app-section').style.display = 'block';
}

function showAuth() {
  document.getElementById('auth-section').style.display = 'flex';
  document.getElementById('app-section').style.display = 'none';
}

function showLogin() {
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('register-form').style.display = 'none';
}

function showRegister() {
  document.getElementById('login-form').style.display = 'none';
  document.getElementById('register-form').style.display = 'block';
}

// ─── AUTH ─────────────────────────────────────────────────
async function login() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.textContent = '';

  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }

  try {
    const res  = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Login failed.'; return; }
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    showApp();
    showPage('dashboard');
  } catch (err) {
    errEl.textContent = 'Server error. Please try again.';
  }
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = data.error || 'Registration failed.'; return; }
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    showApp();
    showPage('dashboard');
  } catch (err) {
    errEl.textContent = 'Server error. Please try again.';
  }
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
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  if (res.status === 401) { logout(); return null; }
  return res.json();
}

// ─── NAVIGATION ───────────────────────────────────────────
const pages = ['dashboard', 'transactions', 'budget', 'goals', 'recurring', 'ai', 'profile'];

function showPage(name) {
  pages.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.style.display = p === name ? 'block' : 'none';
  });

  document.querySelectorAll('.nav-links button').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent.toLowerCase().includes(name.toLowerCase()) ||
       (name === 'ai' && btn.textContent.toLowerCase().includes('ai'))) {
      btn.classList.add('active');
    }
  });

  if (name === 'dashboard')    loadDashboard();
  if (name === 'transactions') loadTransactions();
  if (name === 'budget')       loadBudgets();
  if (name === 'goals')        loadGoals();
  if (name === 'recurring')    loadRecurring();
  if (name === 'ai')           loadAI();
  if (name === 'profile')      loadProfile();
}

function toggleNav() {
  document.querySelector('.nav-links').classList.toggle('open');
}

// ─── DASHBOARD ────────────────────────────────────────────
async function loadDashboard() {
  const transactions = await apiFetch('/api/transactions');
  if (!transactions) return;

  const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  document.getElementById('dash-income').textContent  = `₹${income.toFixed(2)}`;
  document.getElementById('dash-expense').textContent = `₹${expense.toFixed(2)}`;
  document.getElementById('dash-balance').textContent = `₹${balance.toFixed(2)}`;
  document.getElementById('dash-balance').style.color = balance >= 0 ? '#4ade80' : '#f87171';

  const recent = transactions.slice(0, 5);
  const el = document.getElementById('dash-recent');
  if (recent.length === 0) { el.innerHTML = '<p class="empty">No transactions yet.</p>'; }
  else {
    el.innerHTML = recent.map(t => `
      <div class="list-item">
        <div class="left">
          <span class="label">${t.category}</span>
          <span class="sub">${t.note || ''} · ${new Date(t.date).toLocaleDateString()}</span>
        </div>
        <span class="amount-${t.type}">${t.type === 'income' ? '+' : '-'}₹${t.amount.toFixed(2)}</span>
      </div>
    `).join('');
  }

  const tip = await apiFetch('/api/ai/daily-tip');
  if (tip) document.getElementById('dash-tip').textContent = tip.tip;
}

// ─── TRANSACTIONS ─────────────────────────────────────────
async function loadTransactions() {
  const list = await apiFetch('/api/transactions');
  const el   = document.getElementById('txn-list');
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
    </div>
  `).join('');
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

  const data = await apiFetch('/api/transactions', 'POST', { type, amount, category, note, date: date || new Date() });
  if (!data) return;
  document.getElementById('txn-amount').value   = '';
  document.getElementById('txn-category').value = '';
  document.getElementById('txn-note').value     = '';
  document.getElementById('txn-date').value     = '';
  loadTransactions();
}

async function deleteTransaction(id) {
  if (!confirm('Delete this transaction?')) return;
  await apiFetch(`/api/transactions/${id}`, 'DELETE');
  loadTransactions();
}

// ─── BUDGET ───────────────────────────────────────────────
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
    </div>
  `).join('');
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

// ─── GOALS ────────────────────────────────────────────────
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
      </div>
    `;
  }).join('');
}

async function addGoal() {
  const title       = document.getElementById('goal-title').value.trim();
  const targetAmount = parseFloat(document.getElementById('goal-target').value);
  const savedAmount  = parseFloat(document.getElementById('goal-saved').value) || 0;
  const deadline    = document.getElementById('goal-deadline').value;
  const errEl       = document.getElementById('goal-error');
  errEl.textContent = '';

  if (!title || !targetAmount) { errEl.textContent = 'Title and target amount are required.'; return; }

  await apiFetch('/api/goals', 'POST', { title, targetAmount, savedAmount, deadline: deadline || undefined });
  document.getElementById('goal-title').value  = '';
  document.getElementById('goal-target').value = '';
  document.getElementById('goal-saved').value  = '';
  document.getElementById('goal-deadline').value = '';
  loadGoals();
}

async function deleteGoal(id) {
  if (!confirm('Delete this goal?')) return;
  await apiFetch(`/api/goals/${id}`, 'DELETE');
  loadGoals();
}

// ─── RECURRING ────────────────────────────────────────────
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
    </div>
  `).join('');
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

// ─── AI INSIGHTS ──────────────────────────────────────────
async function loadAI() {
  const [scoreData, tipData, alertsData, summaryData] = await Promise.all([
    apiFetch('/api/ai/health-score'),
    apiFetch('/api/ai/daily-tip'),
    apiFetch('/api/ai/alerts'),
    apiFetch('/api/ai/weekly-summary')
  ]);

  if (scoreData) {
    const score = scoreData.score;
    const scoreEl = document.getElementById('ai-score');
    scoreEl.textContent = score;
    scoreEl.style.color = score >= 70 ? '#4ade80' : score >= 40 ? '#facc15' : '#f87171';
  }

  if (tipData) document.getElementById('ai-tip').textContent = tipData.tip;

  if (alertsData) {
    document.getElementById('ai-alerts').innerHTML = alertsData.alerts.map(a =>
      `<p style="padding:8px 0;border-bottom:1px solid #2a3045">${a}</p>`
    ).join('');
  }

  if (summaryData) {
    document.getElementById('ai-summary').innerHTML = `
      <div class="list-item">
        <span>💰 Total Income</span>
        <span class="amount-income">₹${summaryData.income.toFixed(2)}</span>
      </div>
      <div class="list-item">
        <span>💸 Total Expenses</span>
        <span class="amount-expense">₹${summaryData.expense.toFixed(2)}</span>
      </div>
      <div class="list-item">
        <span>🏦 Balance</span>
        <span style="font-weight:bold;color:${summaryData.balance >= 0 ? '#4ade80' : '#f87171'}">₹${summaryData.balance.toFixed(2)}</span>
      </div>
    `;
  }
}

// ─── PROFILE ──────────────────────────────────────────────
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
