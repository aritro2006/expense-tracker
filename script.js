const API_URL = 'https://expense-tracker-shck.onrender.com/api';

let allTransactions = [];
let currentType = 'income';
let barChartInstance = null;
let donutChartInstance = null;
let barChart2Instance = null;
let donutChart2Instance = null;
let categoryChartInstance = null;

// ===== AUTH =====
function switchTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('loginTabBtn').classList.toggle('active', tab === 'login');
  document.getElementById('registerTabBtn').classList.toggle('active', tab === 'register');
}

async function registerUser(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const msg = document.getElementById('register-msg');
  msg.className = 'auth-msg';
  msg.textContent = 'Creating account...';
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok) {
      msg.className = 'auth-msg success';
      msg.textContent = '✓ Account created! Please login.';
      setTimeout(() => switchTab('login'), 1500);
    } else {
      msg.textContent = data.message || 'Registration failed.';
    }
  } catch {
    msg.textContent = 'Server error. Try again.';
  }
}

async function loginUser(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('login-msg');
  msg.className = 'auth-msg';
  msg.textContent = 'Logging in...';
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('userName', data.name || email.split('@')[0]);
      showDashboard();
    } else {
      msg.textContent = data.message || 'Invalid credentials.';
    }
  } catch {
    msg.textContent = 'Server error. Try again.';
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('userName');
  document.getElementById('dashboard-section').classList.add('hidden');
  document.getElementById('auth-section').style.display = 'flex';
  document.getElementById('ai-chat-panel')?.classList.add('hidden');
  showToast('Logged out successfully', 'success');
}

// ===== DASHBOARD =====
function showDashboard() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('dashboard-section').classList.remove('hidden');
  const name = localStorage.getItem('userName') || 'User';
  document.getElementById('user-name-display').textContent = name;
  document.getElementById('user-avatar').textContent = name[0].toUpperCase();
  setGreeting();
  loadTransactions();
  loadWeeklySummary();
  loadDailyTip();
  loadAlerts();
}

function setGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greeting-text').textContent =
    `${greet}, ${localStorage.getItem('userName') || 'User'} 👋`;
}

// ===== SECTION NAVIGATION =====
function showSection(section, navEl) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navEl) navEl.classList.add('active');
  document.getElementById('view-dashboard').classList.toggle('hidden', section !== 'dashboard');
  document.getElementById('view-transactions').classList.toggle('hidden', section !== 'transactions');
  document.getElementById('view-budget').classList.toggle('hidden', section !== 'budget');
  document.getElementById('view-analytics').classList.toggle('hidden', section !== 'analytics');
  const titles = { dashboard: 'Dashboard', transactions: 'Transactions', budget: 'Budgets', analytics: 'Analytics' };
  document.getElementById('page-title').textContent = titles[section] || 'Dashboard';
  if (section === 'budget') loadBudgets();
  if (section === 'analytics') renderAnalyticsCharts();
  if (section === 'transactions') renderFullTransactionList(allTransactions);
}

// ===== TRANSACTIONS =====
async function loadTransactions() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/transactions`, {
      headers: { 'Authorization': token }
    });
    const data = await res.json();
    if (res.ok) {
      allTransactions = data;
      renderAll(data);
    } else if (res.status === 401) {
      logout();
    }
  } catch {
    showToast('Failed to load transactions', 'error');
  }
}

function renderAll(transactions) {
  updateSummaryCards(transactions);
  renderTransactionList(transactions);
  renderCharts(transactions);
}

function updateSummaryCards(transactions) {
  const income = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  document.getElementById('total-balance').textContent = formatCurrency(income - expense);
  document.getElementById('total-income').textContent = formatCurrency(income);
  document.getElementById('total-expense').textContent = formatCurrency(expense);
  document.getElementById('total-count').textContent = transactions.length;
}

function buildTransactionHTML(t) {
  const isIncome = t.amount > 0;
  const date = new Date(t.date).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const emoji = t.emoji || (isIncome ? '💰' : '💸');
  const category = t.category || '';
  return `
    <div class="transaction-item" id="t-${t._id}">
      <div class="t-icon ${isIncome ? 'income' : 'expense'}">${emoji}</div>
      <div class="t-details">
        <strong>${escapeHTML(t.text)}</strong>
        <small>${date}${category ? ` · ${category}` : ''}</small>
      </div>
      <span class="t-amount ${isIncome ? 'income' : 'expense'}">
        ${isIncome ? '+' : '-'}${formatCurrency(Math.abs(t.amount))}
      </span>
      <button class="t-delete" onclick="deleteTransaction('${t._id}')">
        <i class="fa fa-trash"></i>
      </button>
    </div>`;
}

function renderTransactionList(transactions) {
  const list = document.getElementById('transaction-list');
  if (!list) return;
  if (transactions.length === 0) {
    list.innerHTML = `<div class="empty-state"><i class="fa fa-inbox"></i><p>No transactions found.</p></div>`;
    return;
  }
  list.innerHTML = transactions.slice().reverse().slice(0, 10).map(buildTransactionHTML).join('');
}

function renderFullTransactionList(transactions) {
  const list = document.getElementById('transaction-list-full');
  if (!list) return;
  if (transactions.length === 0) {
    list.innerHTML = `<div class="empty-state"><i class="fa fa-inbox"></i><p>No transactions found.</p></div>`;
    return;
  }
  list.innerHTML = transactions.slice().reverse().map(buildTransactionHTML).join('');
}

function filterTransactions(type, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  let filtered = allTransactions;
  if (type === 'income') filtered = allTransactions.filter(t => t.amount > 0);
  if (type === 'expense') filtered = allTransactions.filter(t => t.amount < 0);
  renderTransactionList(filtered);
  renderFullTransactionList(filtered);
}

async function addTransaction(e) {
  e.preventDefault();
  const text = document.getElementById('t-text').value.trim();
  const rawAmount = parseFloat(document.getElementById('t-amount').value);
  const type = document.getElementById('t-type').value;
  const amount = type === 'expense' ? -Math.abs(rawAmount) : Math.abs(rawAmount);
  const token = localStorage.getItem('token');

  let category = 'Other';
  let emoji = type === 'income' ? '💰' : '💸';

  try {
    const catRes = await fetch(`${API_URL}/ai/categorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ text })
    });
    const catData = await catRes.json();
    category = catData.category || 'Other';
    emoji = catData.emoji || emoji;
    const catDisplay = document.getElementById('category-display');
    catDisplay.textContent = `${emoji} ${category}`;
    catDisplay.classList.remove('hidden');
  } catch {}

  try {
    const res = await fetch(`${API_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ text, amount, category, emoji })
    });
    const data = await res.json();
    if (res.ok) {
      closeModal();
      showToast(`${emoji} Transaction added!`, 'success');
      await loadTransactions();
      await loadAlerts();
    } else {
      showToast(data.message || 'Failed to add', 'error');
    }
  } catch {
    showToast('Server error.', 'error');
  }
}

async function deleteTransaction(id) {
  const token = localStorage.getItem('token');
  const item = document.getElementById(`t-${id}`);
  if (item) item.style.opacity = '0.4';
  try {
    const res = await fetch(`${API_URL}/transactions/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': token }
    });
    if (res.ok) {
      showToast('Transaction deleted', 'success');
      loadTransactions();
    } else {
      if (item) item.style.opacity = '1';
      showToast('Failed to delete', 'error');
    }
  } catch {
    if (item) item.style.opacity = '1';
    showToast('Server error.', 'error');
  }
}

// ===== CSV EXPORT =====
function exportCSV() {
  if (!allTransactions.length) {
    showToast('No transactions to export', 'error');
    return;
  }
  const headers = ['Date', 'Description', 'Category', 'Type', 'Amount (₹)'];
  const rows = allTransactions.slice().reverse().map(t => {
    const date = new Date(t.date).toLocaleDateString('en-IN');
    const type = t.amount > 0 ? 'Income' : 'Expense';
    const amount = Math.abs(t.amount).toFixed(2);
    return [date, `"${t.text}"`, t.category || 'Other', type, amount].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ExpenseTracker_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ CSV exported!', 'success');
}

// ===== SMART INPUT — CLIENT PARSE + AI REFINE =====
function quickParse(text) {
  const lower = text.toLowerCase();

  // Extract number
  const amountMatch = text.match(/\d+(\.\d+)?/);
  const amount = amountMatch ? parseFloat(amountMatch[0]) : 0;

  // Detect type
  const expenseWords = ['spent','paid','bought','spend','pay','bill','fee','charge','cost','expense','purchase','eating','food','lunch','dinner','breakfast','coffee','uber','ola','petrol','diesel','rent','electricity','groceries'];
  const incomeWords  = ['received','earned','got','salary','income','bonus','refund','credit','deposited','freelance','payment received'];
  let type = 'expense';
  if (incomeWords.some(w => lower.includes(w))) type = 'income';
  if (expenseWords.some(w => lower.includes(w))) type = 'expense';

  // Clean description — remove numbers and filler words
  let description = text
    .replace(/\d+(\.\d+)?/g, '')
    .replace(/\b(spent|paid|on|for|today|yesterday|just|rs|inr|rupees?|₹|a|the|some|my)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!description || description.length < 2) description = text.trim();

  return { text: description, amount, type };
}

async function parseSmartInput() {
  const smartInput = document.getElementById('smart-input');
  const rawText = smartInput.value.trim();

  if (!rawText) {
    showToast('Type something first', 'error');
    return;
  }

  const btn = document.querySelector('.btn-smart');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';

  // Step 1: Fill instantly with client-side parse (always works)
  const quick = quickParse(rawText);
  console.log('Quick parse:', quick);

  document.getElementById('t-text').value = quick.text || rawText;
  if (quick.amount > 0) document.getElementById('t-amount').value = quick.amount;
  setType(quick.type);
  smartInput.value = '';
  showToast('✨ Form filled!', 'success');

  // Step 2: AI refines silently in background
  try {
    const token = localStorage.getItem('token');
    if (!token) return;

    const res = await fetch(`${API_URL}/ai/parse-transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ text: rawText })
    });

    if (res.ok) {
      const data = await res.json();
      console.log('AI refined:', data);
      if (data.text && data.text.length > 1 && data.text !== rawText)
        document.getElementById('t-text').value = data.text;
      if (data.amount && data.amount > 0)
        document.getElementById('t-amount').value = Math.abs(data.amount);
      if (data.type === 'income' || data.type === 'expense')
        setType(data.type);
    }
  } catch (err) {
    console.log('AI refine skipped:', err.message);
  } finally {
    btn.innerHTML = '<i class="fa fa-wand-magic-sparkles"></i>';
    btn.disabled = false;
  }
}

// ===== CHARTS =====
function renderCharts(transactions) {
  const income = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  if (barChartInstance) barChartInstance.destroy();
  barChartInstance = new Chart(document.getElementById('barChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{
        data: [income, expense],
        backgroundColor: ['rgba(16,185,129,0.7)', 'rgba(239,68,68,0.7)'],
        borderColor: ['#10b981', '#ef4444'],
        borderWidth: 2, borderRadius: 10, borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ₹${ctx.raw.toFixed(2)}` } }
      },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#94a3b8', callback: v => `₹${v}` }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });

  if (donutChartInstance) donutChartInstance.destroy();
  donutChartInstance = new Chart(document.getElementById('donutChart').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{
        data: [income || 0.001, expense || 0.001],
        backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(239,68,68,0.8)'],
        borderColor: ['#10b981', '#ef4444'],
        borderWidth: 2, hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#94a3b8', padding: 20, font: { family: 'Inter' }, usePointStyle: true }
        },
        tooltip: { callbacks: { label: ctx => ` ₹${ctx.raw.toFixed(2)}` } }
      }
    }
  });
}

function renderAnalyticsCharts() {
  const income = allTransactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = allTransactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  if (barChart2Instance) barChart2Instance.destroy();
  barChart2Instance = new Chart(document.getElementById('barChart2').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{
        data: [income, expense],
        backgroundColor: ['rgba(16,185,129,0.7)', 'rgba(239,68,68,0.7)'],
        borderColor: ['#10b981', '#ef4444'],
        borderWidth: 2, borderRadius: 10, borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ₹${ctx.raw.toFixed(2)}` } }
      },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#94a3b8', callback: v => `₹${v}` }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });

  if (donutChart2Instance) donutChart2Instance.destroy();
  donutChart2Instance = new Chart(document.getElementById('donutChart2').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{
        data: [income || 0.001, expense || 0.001],
        backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(239,68,68,0.8)'],
        borderColor: ['#10b981', '#ef4444'],
        borderWidth: 2, hoverOffset: 8
      }]
    },
    options: {
      responsive: true, cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 20, font: { family: 'Inter' }, usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => ` ₹${ctx.raw.toFixed(2)}` } }
      }
    }
  });

  const now = new Date();
  const monthExpenses = allTransactions.filter(t => {
    const d = new Date(t.date);
    return t.amount < 0 && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const catMap = {};
  monthExpenses.forEach(t => {
    const key = t.category || 'Other';
    catMap[key] = (catMap[key] || 0) + Math.abs(t.amount);
  });
  const catLabels = Object.keys(catMap);
  const catData = Object.values(catMap);
  const colors = ['#7c3aed','#10b981','#ef4444','#f59e0b','#0ea5e9','#ec4899','#8b5cf6','#14b8a6'];

  if (categoryChartInstance) categoryChartInstance.destroy();
  categoryChartInstance = new Chart(document.getElementById('categoryChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: catLabels.length ? catLabels : ['No Data'],
      datasets: [{
        data: catData.length ? catData : [0],
        backgroundColor: colors.slice(0, catLabels.length || 1),
        borderRadius: 8, borderSkipped: false
      }]
    },
    options: {
      responsive: true, indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ₹${ctx.raw.toFixed(2)}` } }
      },
      scales: {
        x: { ticks: { color: '#94a3b8', callback: v => `₹${v}` }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#94a3b8' }, grid: { display: false } }
      }
    }
  });
}

// ===== BUDGET =====
async function loadBudgets() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/budget/status`, { headers: { 'Authorization': token } });
    const data = await res.json();
    renderBudgets(data);
  } catch { showToast('Failed to load budgets', 'error'); }
}

function renderBudgets(budgets) {
  const list = document.getElementById('budget-list');
  const alertsContainer = document.getElementById('budget-overspend-alerts');
  alertsContainer.innerHTML = '';

  if (!budgets.length) {
    list.innerHTML = `<div class="empty-state"><i class="fa fa-bullseye"></i><p>No budgets set yet. Click "Set Budget" to start.</p></div>`;
    return;
  }

  const catEmojis = {
    Food: '🍔', Transport: '🚗', Shopping: '🛍️', Entertainment: '🎬',
    Health: '💊', Education: '📚', Utilities: '💡', Other: '📦',
    Salary: '💰', Business: '💼'
  };

  list.innerHTML = budgets.map(b => {
    const statusClass = b.percent >= 100 ? 'danger' : b.percent >= 75 ? 'warning' : 'safe';
    const emoji = catEmojis[b.category] || '📦';
    const remainingText = b.overspent
      ? `Over by ₹${Math.abs(b.remaining).toFixed(0)}`
      : `₹${b.remaining.toFixed(0)} left`;
    return `
      <div class="budget-card">
        <div class="budget-card-header">
          <div class="budget-cat">
            <span class="budget-cat-emoji">${emoji}</span>${b.category}
          </div>
          <button class="budget-delete" onclick="deleteBudget('${b._id}')">
            <i class="fa fa-trash"></i>
          </button>
        </div>
        <div class="budget-amounts">
          <span>Spent: <strong>₹${b.spent.toFixed(0)}</strong></span>
          <span>Limit: <strong>₹${b.limit.toFixed(0)}</strong></span>
        </div>
        <div class="budget-bar">
          <div class="budget-bar-fill ${statusClass}" style="width:${b.percent}%"></div>
        </div>
        <div class="budget-footer">
          <span class="budget-remaining ${b.overspent ? 'over' : ''}">${remainingText}</span>
          <span class="budget-percent ${statusClass}">${b.percent}%</span>
        </div>
        ${b.overspent ? `<div class="budget-ai-warning" id="warn-${b._id}">⚠️ Loading AI warning...</div>` : ''}
      </div>`;
  }).join('');

  budgets.filter(b => b.overspent).forEach(b => getBudgetAIWarning(b));
}

async function getBudgetAIWarning(b) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/ai/budget-warning`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ category: b.category, spent: b.spent, limit: b.limit })
    });
    const data = await res.json();
    const el = document.getElementById(`warn-${b._id}`);
    if (el) el.textContent = data.warning;
  } catch {}
}

async function saveBudget(e) {
  e.preventDefault();
  const category = document.getElementById('budget-category').value;
  const limit = parseFloat(document.getElementById('budget-limit').value);
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ category, limit })
    });
    if (res.ok) {
      closeBudgetModal();
      showToast('✅ Budget saved!', 'success');
      loadBudgets();
    } else {
      showToast('Failed to save budget', 'error');
    }
  } catch { showToast('Server error.', 'error'); }
}

async function deleteBudget(id) {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/budget/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': token }
    });
    if (res.ok) { showToast('Budget deleted', 'success'); loadBudgets(); }
  } catch { showToast('Failed to delete', 'error'); }
}

function openBudgetModal() {
  document.getElementById('budget-modal-overlay').classList.remove('hidden');
}
function closeBudgetModal() {
  document.getElementById('budget-modal-overlay').classList.add('hidden');
  document.getElementById('budget-category').value = '';
  document.getElementById('budget-limit').value = '';
}
function closeBudgetModalOutside(e) {
  if (e.target === document.getElementById('budget-modal-overlay')) closeBudgetModal();
}

// ===== MODALS =====
function openModal() {
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('t-text').focus();
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('t-text').value = '';
  document.getElementById('t-amount').value = '';
  document.getElementById('smart-input').value = '';
  document.getElementById('category-display').classList.add('hidden');
  setType('income');
}
function closeModalOutside(e) {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
}
function setType(type) {
  currentType = type;
  document.getElementById('t-type').value = type;
  document.getElementById('incomeBtn').classList.toggle('active', type === 'income');
  document.getElementById('expenseBtn').classList.toggle('active', type === 'expense');
}

// ===== WEEKLY SUMMARY =====
async function loadWeeklySummary() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/ai/weekly-summary`, {
      headers: { 'Authorization': token }
    });
    const data = await res.json();
    document.getElementById('weekly-summary-text').textContent =
      data.summary || 'No transactions this week yet.';
  } catch {
    document.getElementById('weekly-summary-text').textContent = 'Weekly summary unavailable.';
  }
}

// ===== DAILY TIP =====
async function loadDailyTip() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/ai/daily-tip`, {
      headers: { 'Authorization': token }
    });
    const data = await res.json();
    document.getElementById('daily-tip-text').textContent =
      data.tip || '💡 Keep tracking your expenses!';
  } catch {
    document.getElementById('daily-tip-text').textContent =
      '💡 Track every rupee to build better habits!';
  }
}

// ===== ALERTS =====
async function loadAlerts() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/ai/alerts`, {
      headers: { 'Authorization': token }
    });
    const data = await res.json();
    const container = document.getElementById('alerts-container');
    container.innerHTML = '';
    const iconMap = {
      warning: 'fa-triangle-exclamation',
      info: 'fa-circle-info',
      success: 'fa-circle-check'
    };
    (data.alerts || []).forEach(alert => {
      const div = document.createElement('div');
      div.className = `alert-item ${alert.type || 'info'}`;
      div.innerHTML = `
        <i class="fa ${iconMap[alert.type] || 'fa-circle-info'}"></i>
        <span>${alert.message}</span>
        <span class="alert-dismiss" onclick="this.parentElement.remove()">✕</span>`;
      container.appendChild(div);
    });
  } catch {}
}

// ===== AI BUBBLE =====
function toggleAIChat() {
  const panel = document.getElementById('ai-chat-panel');
  const icon = document.getElementById('ai-fab-icon');
  panel.classList.toggle('hidden');
  icon.className = panel.classList.contains('hidden')
    ? 'fa-solid fa-robot'
    : 'fa fa-times';
}

// ===== AI CHAT =====
async function analyzeFinances() {
  addAIMessage('Analyze my finances and give me 3-5 specific actionable suggestions.', 'user');
  showTyping();
  try {
    const res = await fetch(`${API_URL}/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('token') },
      body: JSON.stringify({ message: 'Analyze my finances and give specific suggestions.' })
    });
    const data = await res.json();
    removeTyping();
    addAIMessage(data.reply, 'bot');
  } catch { removeTyping(); addAIMessage('Analysis failed. Try again.', 'bot'); }
}

async function generateMonthlyReport() {
  addAIMessage('Generate my monthly financial report.', 'user');
  showTyping();
  try {
    const res = await fetch(`${API_URL}/ai/monthly-report`, {
      headers: { 'Authorization': localStorage.getItem('token') }
    });
    const data = await res.json();
    removeTyping();
    const stats = data.stats
      ? `\n\n📊 Income: ₹${data.stats.income} | Expenses: ₹${data.stats.expense} | Saved: ₹${data.stats.saved} | Transactions: ${data.stats.count}`
      : '';
    addAIMessage(data.reply + stats, 'bot');
  } catch { removeTyping(); addAIMessage('Report generation failed.', 'bot'); }
}

async function getPrediction() {
  addAIMessage('Predict my expenses for next month.', 'user');
  showTyping();
  try {
    const res = await fetch(`${API_URL}/ai/predict`, {
      headers: { 'Authorization': localStorage.getItem('token') }
    });
    const data = await res.json();
    removeTyping();
    addAIMessage(data.reply, 'bot');
  } catch { removeTyping(); addAIMessage('Prediction unavailable.', 'bot'); }
}

async function sendAIMessage() {
  const input = document.getElementById('ai-input');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  addAIMessage(message, 'user');
  showTyping();
  try {
    const res = await fetch(`${API_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('token') },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    removeTyping();
    addAIMessage(data.reply, 'bot');
  } catch { removeTyping(); addAIMessage('Something went wrong.', 'bot'); }
}

function addAIMessage(text, sender) {
  const win = document.getElementById('ai-chat-window');
  const welcome = win.querySelector('.ai-welcome-msg');
  if (welcome) welcome.remove();
  const icon = sender === 'bot'
    ? '<i class="fa-solid fa-robot"></i>'
    : '<i class="fa fa-user"></i>';
  const div = document.createElement('div');
  div.className = `ai-msg ${sender}`;
  div.innerHTML = `
    <div class="ai-msg-avatar">${icon}</div>
    <div class="ai-msg-bubble">${text}</div>`;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}

function showTyping() {
  const win = document.getElementById('ai-chat-window');
  const div = document.createElement('div');
  div.className = 'ai-typing';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="ai-msg-avatar" style="background:rgba(124,58,237,0.2);color:var(--accent2);
    width:26px;height:26px;border-radius:50%;display:flex;align-items:center;
    justify-content:center;font-size:0.72rem;flex-shrink:0">
      <i class="fa-solid fa-robot"></i>
    </div>
    <div class="ai-typing-dots">
      <span></span><span></span><span></span>
    </div>`;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}

function removeTyping() {
  document.getElementById('typing-indicator')?.remove();
}

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = type === 'success' ? `✓ ${msg}` : `✕ ${msg}`;
  toast.className = `toast ${type}`;
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ===== UTILS =====
function formatCurrency(amount) {
  return '₹' + Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('token')) showDashboard();
});
