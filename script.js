const API_URL = 'https://expense-tracker-shck.onrender.com/api';

let allTransactions       = [];
let filteredTx            = [];
let currentType           = 'income';
let recurringType         = 'income';
let editingId             = null;
let visibleCount          = 10;
let activeFilter          = 'all';
let activeAccount         = 'all';
let searchQuery           = '';
let barChartInstance      = null;
let donutChartInstance    = null;
let barChart2Instance     = null;
let donutChart2Instance   = null;
let categoryChartInstance = null;
let trendChartInstance    = null;

// ===== THEME =====
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('theme-icon').className =
    saved === 'dark' ? 'fa fa-moon' : 'fa fa-sun';
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  document.getElementById('theme-icon').className =
    next === 'dark' ? 'fa fa-moon' : 'fa fa-sun';
}

// ===== AUTH =====
function switchTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden',    tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
  document.getElementById('loginTabBtn').classList.toggle('active',    tab === 'login');
  document.getElementById('registerTabBtn').classList.toggle('active', tab === 'register');
}

async function registerUser(e) {
  e.preventDefault();
  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const msg      = document.getElementById('register-msg');
  msg.className  = 'auth-msg';
  msg.textContent = 'Creating account...';
  try {
    const res  = await fetch(`${API_URL}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok) {
      msg.className   = 'auth-msg success';
      msg.textContent = '✓ Account created! Please login.';
      setTimeout(() => switchTab('login'), 1500);
    } else { msg.textContent = data.message || 'Registration failed.'; }
  } catch { msg.textContent = 'Server error. Try again.'; }
}

async function loginUser(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const msg      = document.getElementById('login-msg');
  msg.className  = 'auth-msg';
  msg.textContent = 'Logging in...';
  try {
    const res  = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token',    data.token);
      localStorage.setItem('userName', data.name || email.split('@')[0]);
      localStorage.setItem('emailNotif', data.emailNotifications !== false ? 'true' : 'false');
      showDashboard();
      processRecurring();
    } else { msg.textContent = data.message || 'Invalid credentials.'; }
  } catch { msg.textContent = 'Server error. Try again.'; }
}

function logout() {
  ['token', 'userName', 'emailNotif'].forEach(k => localStorage.removeItem(k));
  document.getElementById('dashboard-section').classList.add('hidden');
  document.getElementById('auth-section').style.display = 'flex';
  document.getElementById('ai-chat-panel').classList.add('hidden');
  showToast('Logged out successfully', 'success');
}

// ===== DASHBOARD =====
function showDashboard() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('dashboard-section').classList.remove('hidden');
  const name = localStorage.getItem('userName') || 'User';
  document.getElementById('user-name-display').textContent = name;
  document.getElementById('user-avatar').textContent       = name[0].toUpperCase();
  setGreeting();
  loadTransactions();
  loadWeeklySummary();
  loadDailyTip();
  loadAlerts();
  loadHealthScore();
}

function setGreeting() {
  const h     = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('greeting-text').textContent =
    `${greet}, ${localStorage.getItem('userName') || 'User'} 👋`;
}

// ===== SECTION NAVIGATION =====
function showSection(section, navEl) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (navEl) navEl.classList.add('active');
  ['dashboard', 'transactions', 'budget', 'goals', 'analytics', 'recurring', 'profile'].forEach(v =>
    document.getElementById(`view-${v}`).classList.toggle('hidden', v !== section)
  );
  const titles = {
    dashboard: 'Dashboard', transactions: 'Transactions', budget: 'Budgets',
    goals: 'Savings Goals', analytics: 'Analytics', recurring: 'Recurring', profile: 'Profile'
  };
  document.getElementById('page-title').textContent = titles[section] || 'Dashboard';
  if (section === 'budget')       loadBudgets();
  if (section === 'analytics')    renderAnalyticsCharts();
  if (section === 'transactions') renderFullTransactionList();
  if (section === 'recurring')    loadRecurring();
  if (section === 'goals')        loadGoals();
  if (section === 'profile')      loadProfile();
}

// ===== TRANSACTIONS =====
async function loadTransactions() {
  const token = localStorage.getItem('token');
  try {
    const res  = await fetch(`${API_URL}/transactions`, { headers: { 'Authorization': token } });
    const data = await res.json();
    if (res.ok) {
      allTransactions = data;
      applyFilters();
    } else if (res.status === 401) { logout(); }
  } catch { showToast('Failed to load transactions', 'error'); }
}

function applyFilters() {
  let result = [...allTransactions];
  if (activeFilter === 'income')  result = result.filter(t => t.amount > 0);
  if (activeFilter === 'expense') result = result.filter(t => t.amount < 0);
  if (activeAccount !== 'all')    result = result.filter(t => (t.account || 'Main') === activeAccount);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    result = result.filter(t =>
      t.text.toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q) ||
      (t.notes    || '').toLowerCase().includes(q)
    );
  }
  filteredTx   = result;
  visibleCount = 10;
  updateSummaryCards(allTransactions);
  renderTransactionList(allTransactions.slice(0, 10));
  renderFullTransactionList();
  renderCharts(allTransactions);
}

function filterTransactions(type, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = type;
  applyFilters();
}
function searchTransactions(q) { searchQuery = q; applyFilters(); }
function filterByAccount(val)  { activeAccount = val; applyFilters(); }

function updateSummaryCards(transactions) {
  const income  = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  document.getElementById('total-balance').textContent  = formatCurrency(income - expense);
  document.getElementById('total-income').textContent   = formatCurrency(income);
  document.getElementById('total-expense').textContent  = formatCurrency(expense);
  document.getElementById('total-count').textContent    = transactions.length;
}

function buildTransactionHTML(t) {
  const isIncome = t.amount > 0;
  const date     = new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const emoji    = t.emoji || (isIncome ? '💰' : '💸');
  const notesTag = t.notes ? `<span class="t-notes-tag"> · ${escapeHTML(t.notes)}</span>` : '';
  return `
    <div class="transaction-item" id="t-${t._id}">
      <div class="t-icon ${isIncome ? 'income' : 'expense'}">${emoji}</div>
      <div class="t-details">
        <strong>${escapeHTML(t.text)}</strong>
        <small>${date}${t.category ? ` · ${t.category}` : ''}${t.account && t.account !== 'Main' ? ` · ${t.account}` : ''}${notesTag}</small>
      </div>
      <span class="t-amount ${isIncome ? 'income' : 'expense'}">
        ${isIncome ? '+' : '-'}${formatCurrency(Math.abs(t.amount))}
      </span>
      <div class="t-actions">
        <button class="t-edit"   onclick="openEditModal('${t._id}')"><i class="fa fa-pen"></i></button>
        <button class="t-delete" onclick="deleteTransaction('${t._id}')"><i class="fa fa-trash"></i></button>
      </div>
    </div>`;
}

function renderTransactionList(transactions) {
  const list = document.getElementById('transaction-list');
  if (!list) return;
  if (!transactions.length) {
    list.innerHTML = `<div class="empty-state"><i class="fa fa-inbox"></i><p>No transactions yet. Add one!</p></div>`;
    return;
  }
  list.innerHTML = transactions.map(buildTransactionHTML).join('');
}

function renderFullTransactionList() {
  const list = document.getElementById('transaction-list-full');
  if (!list) return;
  const toShow = filteredTx.slice(0, visibleCount);
  if (!filteredTx.length) {
    list.innerHTML = `<div class="empty-state"><i class="fa fa-inbox"></i><p>No transactions found.</p></div>`;
    document.getElementById('load-more-wrap').classList.add('hidden');
    return;
  }
  list.innerHTML = toShow.map(buildTransactionHTML).join('');
  const wrap = document.getElementById('load-more-wrap');
  if (filteredTx.length > visibleCount) {
    wrap.classList.remove('hidden');
    document.getElementById('load-more-btn').innerHTML =
      `<i class="fa fa-chevron-down"></i> Load More (${filteredTx.length - visibleCount} remaining)`;
  } else {
    wrap.classList.add('hidden');
  }
}

function loadMoreTransactions() { visibleCount += 10; renderFullTransactionList(); }

// ===== ADD / EDIT TRANSACTION =====
function openModal() {
  editingId = null;
  document.getElementById('modal-title').innerHTML       = '<i class="fa fa-plus-circle"></i> New Transaction';
  document.getElementById('submit-btn-text').textContent = 'Add Transaction';
  document.getElementById('t-text').value                = '';
  document.getElementById('t-amount').value              = '';
  document.getElementById('t-notes').value               = '';
  document.getElementById('t-account').value             = 'Main';
  document.getElementById('smart-input').value           = '';
  document.getElementById('category-display').classList.add('hidden');
  setType('income');
  document.getElementById('modal-overlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('t-text').focus(), 100);
}

function openEditModal(id) {
  const t = allTransactions.find(tx => tx._id === id);
  if (!t) return;
  editingId = id;
  document.getElementById('modal-title').innerHTML       = '<i class="fa fa-pen"></i> Edit Transaction';
  document.getElementById('submit-btn-text').textContent = 'Save Changes';
  document.getElementById('t-text').value                = t.text;
  document.getElementById('t-amount').value              = Math.abs(t.amount);
  document.getElementById('t-notes').value               = t.notes || '';
  document.getElementById('t-account').value             = t.account || 'Main';
  document.getElementById('smart-input').value           = '';
  document.getElementById('category-display').classList.add('hidden');
  setType(t.amount > 0 ? 'income' : 'expense');
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); editingId = null; }
function closeModalOutside(e) { if (e.target === document.getElementById('modal-overlay')) closeModal(); }

function setType(type) {
  currentType = type;
  document.getElementById('t-type').value = type;
  document.getElementById('incomeBtn').classList.toggle('active',  type === 'income');
  document.getElementById('expenseBtn').classList.toggle('active', type === 'expense');
}

async function submitTransaction(e) {
  e.preventDefault();
  const text      = document.getElementById('t-text').value.trim();
  const rawAmount = parseFloat(document.getElementById('t-amount').value);
  const type      = document.getElementById('t-type').value;
  const notes     = document.getElementById('t-notes').value.trim();
  const account   = document.getElementById('t-account').value;
  const amount    = type === 'expense' ? -Math.abs(rawAmount) : Math.abs(rawAmount);
  const token     = localStorage.getItem('token');
  let category = 'Other';
  let emoji    = type === 'income' ? '💰' : '💸';

  if (!editingId) {
    try {
      const catRes  = await fetch(`${API_URL}/ai/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify({ text })
      });
      if (catRes.ok) {
        const catData = await catRes.json();
        category = catData.category || 'Other';
        emoji    = catData.emoji    || emoji;
        const catEl = document.getElementById('category-display');
        catEl.textContent = `${emoji} Categorized as ${category}`;
        catEl.classList.remove('hidden');
      }
    } catch {}
  } else {
    const ex = allTransactions.find(t => t._id === editingId);
    if (ex) { category = ex.category; emoji = ex.emoji; }
  }

  const url    = editingId ? `${API_URL}/transactions/${editingId}` : `${API_URL}/transactions`;
  const method = editingId ? 'PUT' : 'POST';
  try {
    const res = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ text, amount, category, emoji, notes, account })
    });
    const data = await res.json();
    if (res.ok) {
      closeModal();
      showToast(editingId ? '✏️ Transaction updated!' : `${emoji} Transaction added!`, 'success');
      await loadTransactions();
      await loadAlerts();
    } else { showToast(data.message || 'Failed', 'error'); }
  } catch { showToast('Server error.', 'error'); }
}

async function deleteTransaction(id) {
  const token = localStorage.getItem('token');
  const item  = document.getElementById(`t-${id}`);
  if (item) item.style.opacity = '0.4';
  try {
    const res = await fetch(`${API_URL}/transactions/${id}`, {
      method: 'DELETE', headers: { 'Authorization': token }
    });
    if (res.ok) { showToast('Transaction deleted', 'success'); loadTransactions(); }
    else { if (item) item.style.opacity = '1'; showToast('Failed to delete', 'error'); }
  } catch { if (item) item.style.opacity = '1'; showToast('Server error.', 'error'); }
}

// ===== CSV EXPORT =====
function exportCSV() {
  if (!allTransactions.length) { showToast('No transactions to export', 'error'); return; }
  const headers = ['Date', 'Description', 'Category', 'Account', 'Notes', 'Type', 'Amount (₹)'];
  const rows    = allTransactions.map(t => {
    const date   = new Date(t.date).toLocaleDateString('en-IN');
    const type   = t.amount > 0 ? 'Income' : 'Expense';
    const amount = Math.abs(t.amount).toFixed(2);
    return [date, `"${t.text}"`, t.category || 'Other', t.account || 'Main', `"${t.notes || ''}"`, type, amount].join(',');
  });
  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `ExpenseTracker_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast('✅ CSV exported!', 'success');
}

// ===== SMART INPUT — FIXED INCOME/EXPENSE DETECTION =====
const INCOME_KEYWORDS = [
  'got', 'get', 'received', 'receive', 'earned', 'earn', 'salary', 'income',
  'bonus', 'allowance', 'pocket money', 'pocket', 'stipend', 'refund',
  'cashback', 'cash back', 'gift', 'prize', 'won', 'win', 'scholarship',
  'commission', 'dividend', 'credited', 'credit', 'deposited', 'deposit',
  'freelance', 'payment received', 'collected', 'collect', 'reimbursement',
  'reimburse', 'award', 'awarded', 'incentive', 'profit', 'revenue',
  'return', 'interest', 'payout', 'transferred to me', 'sent me'
];

const EXPENSE_KEYWORDS = [
  'spent', 'spend', 'paid', 'pay', 'bought', 'buy', 'purchased', 'purchase',
  'cost', 'bill', 'fee', 'rent', 'emi', 'subscription', 'recharge',
  'ordered', 'order', 'delivery', 'uber', 'ola', 'metro', 'bus', 'auto',
  'shopping', 'food', 'lunch', 'dinner', 'breakfast', 'snack', 'coffee',
  'medical', 'doctor', 'medicine', 'hospital', 'electricity', 'water',
  'internet', 'phone', 'mobile', 'petrol', 'fuel', 'tax', 'fine',
  'penalty', 'insurance', 'maintenance', 'repair', 'grocery', 'groceries'
];

function quickParse(text) {
  const lower       = text.toLowerCase();
  const amountMatch = text.match(/\d+(\.\d+)?/);
  const amount      = amountMatch ? parseFloat(amountMatch[0]) : 0;

  // Check income keywords first
  const hasIncome  = INCOME_KEYWORDS.some(w => lower.includes(w));
  const hasExpense = EXPENSE_KEYWORDS.some(w => lower.includes(w));

  // Income takes priority only if explicitly found and no expense keyword
  let type = 'expense'; // default
  if (hasIncome && !hasExpense) type = 'income';
  if (hasIncome && hasExpense)  type = 'expense'; // "paid salary" → expense
  if (!hasIncome && !hasExpense) type = 'expense'; // unknown → default expense

  // Clean up description
  let description = text
    .replace(/\d+(\.\d+)?/g, '')
    .replace(/\b(spent|paid|on|for|today|yesterday|just|rs|inr|rupees?|₹|a|the|some|my|as|got|received|from|by|to|in|at|of|and|is|was|this|that)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!description || description.length < 2) description = text.trim();

  return { text: description, amount, type };
}

async function parseSmartInput() {
  const smartInput = document.getElementById('smart-input');
  const rawText    = smartInput.value.trim();
  if (!rawText) { showToast('Type something first', 'error'); return; }

  const btn = document.querySelector('.btn-smart');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';

  // Step 1: Apply local keyword parse immediately for instant feedback
  const quick = quickParse(rawText);
  if (quick.text && quick.text.length > 1) document.getElementById('t-text').value   = quick.text;
  if (quick.amount > 0)                    document.getElementById('t-amount').value = quick.amount;
  setType(quick.type);
  smartInput.value = '';
  showToast('✨ Parsing with AI...', 'success');

  // Step 2: Try AI for better result, override only if confident
  try {
    const token = localStorage.getItem('token');
    const res   = await fetch(`${API_URL}/ai/parse-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ text: rawText })
    });

    if (res.ok) {
      const data = await res.json();

      // Only override description if AI gave something meaningful
      if (data.text && data.text.trim().length > 1 && data.text !== rawText)
        document.getElementById('t-text').value = data.text;

      // Only override amount if AI found one
      if (data.amount && data.amount > 0)
        document.getElementById('t-amount').value = data.amount;

      // Only override type if AI is confident — validate against keywords too
      if (data.type === 'income' || data.type === 'expense') {
        // Double-check: if local parse strongly says income, trust it
        const localHasIncome  = INCOME_KEYWORDS.some(w => rawText.toLowerCase().includes(w));
        const localHasExpense = EXPENSE_KEYWORDS.some(w => rawText.toLowerCase().includes(w));
        if (localHasIncome && !localHasExpense) {
          setType('income'); // Override AI if keywords are clear
        } else {
          setType(data.type);
        }
      }
      showToast('✨ Form filled!', 'success');
    } else {
      showToast('✨ Form filled (local parse)!', 'success');
    }
  } catch {
    showToast('✨ Form filled!', 'success');
  } finally {
    btn.innerHTML = '<i class="fa fa-wand-magic-sparkles"></i>';
    btn.disabled  = false;
  }
}

// ===== RECEIPT SCANNER =====
async function handleReceiptUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const btn = document.querySelector('.receipt-btn');
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
  showToast('📸 Scanning receipt...', 'success');
  try {
    const base64 = await new Promise((resolve, reject) => {
      const reader    = new FileReader();
      reader.onload   = () => resolve(reader.result.split(',')[1]);
      reader.onerror  = reject;
      reader.readAsDataURL(file);
    });
    const token = localStorage.getItem('token');
    const res   = await fetch(`${API_URL}/ai/scan-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ image: base64, mimeType: file.type })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.text)   document.getElementById('t-text').value   = data.text;
      if (data.amount) document.getElementById('t-amount').value = data.amount;
      setType('expense');
      showToast('✅ Receipt scanned!', 'success');
    }
  } catch { showToast('Scan failed', 'error'); }
  finally { btn.innerHTML = '<i class="fa fa-camera"></i>'; input.value = ''; }
}

// ===== CHARTS =====
function renderCharts(transactions) {
  const income  = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  if (barChartInstance)   barChartInstance.destroy();
  if (donutChartInstance) donutChartInstance.destroy();
  barChartInstance = new Chart(document.getElementById('barChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{ data: [income, expense],
        backgroundColor: ['rgba(16,185,129,.7)', 'rgba(239,68,68,.7)'],
        borderColor: ['#10b981', '#ef4444'], borderWidth: 2, borderRadius: 10, borderSkipped: false }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ₹${ctx.raw.toFixed(2)}` } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#94a3b8', callback: v => `₹${v}` }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
  donutChartInstance = new Chart(document.getElementById('donutChart').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{ data: [income || 0.001, expense || 0.001],
        backgroundColor: ['rgba(16,185,129,.8)', 'rgba(239,68,68,.8)'],
        borderColor: ['#10b981', '#ef4444'], borderWidth: 2, hoverOffset: 8 }]
    },
    options: {
      responsive: true, cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 20, usePointStyle: true } },
        tooltip: { callbacks: { label: ctx => ` ₹${ctx.raw.toFixed(2)}` } }
      }
    }
  });
}

function renderAnalyticsCharts() {
  const income  = allTransactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = allTransactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  if (barChart2Instance)     barChart2Instance.destroy();
  if (donutChart2Instance)   donutChart2Instance.destroy();
  if (trendChartInstance)    trendChartInstance.destroy();
  if (categoryChartInstance) categoryChartInstance.destroy();

  barChart2Instance = new Chart(document.getElementById('barChart2').getContext('2d'), {
    type: 'bar',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{ data: [income, expense],
        backgroundColor: ['rgba(16,185,129,.7)', 'rgba(239,68,68,.7)'],
        borderColor: ['#10b981', '#ef4444'], borderWidth: 2, borderRadius: 10, borderSkipped: false }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8' } },
        y: { ticks: { color: '#94a3b8', callback: v => `₹${v}` } }
      }
    }
  });

  donutChart2Instance = new Chart(document.getElementById('donutChart2').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{ data: [income || 0.001, expense || 0.001],
        backgroundColor: ['rgba(16,185,129,.8)', 'rgba(239,68,68,.8)'],
        borderColor: ['#10b981', '#ef4444'], borderWidth: 2 }]
    },
    options: {
      responsive: true, cutout: '70%',
      plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 20, usePointStyle: true } } }
    }
  });

  // 6-Month Trend
  const now    = new Date();
  const labels = [];
  const data   = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }));
    data.push(allTransactions
      .filter(t => {
        const td = new Date(t.date);
        return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear() && t.amount < 0;
      })
      .reduce((s, t) => s + Math.abs(t.amount), 0));
  }
  trendChartInstance = new Chart(document.getElementById('trendChart').getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Expenses', data,
        borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.1)',
        borderWidth: 2.5, pointBackgroundColor: '#7c3aed', pointRadius: 4, fill: true, tension: 0.4 }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ₹${ctx.raw.toFixed(0)}` } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#94a3b8', callback: v => `₹${v}` }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });

  // Category chart
  const monthExp = allTransactions.filter(t => {
    const d = new Date(t.date);
    return t.amount < 0 && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const catMap = {};
  monthExp.forEach(t => { const k = t.category || 'Other'; catMap[k] = (catMap[k] || 0) + Math.abs(t.amount); });
  const catLabels = Object.keys(catMap);
  const catData   = Object.values(catMap);
  const colors    = ['#7c3aed', '#10b981', '#ef4444', '#f59e0b', '#0ea5e9', '#ec4899', '#8b5cf6', '#14b8a6'];

  categoryChartInstance = new Chart(document.getElementById('categoryChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: catLabels.length ? catLabels : ['No Data'],
      datasets: [{ data: catData.length ? catData : [0],
        backgroundColor: colors.slice(0, catLabels.length || 1), borderRadius: 8, borderSkipped: false }]
    },
    options: {
      responsive: true, indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#94a3b8', callback: v => `₹${v}` } },
        y: { ticks: { color: '#94a3b8' }, grid: { display: false } }
      }
    }
  });

  // Top 5 Categories
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total  = catData.reduce((s, v) => s + v, 0) || 1;
  document.getElementById('top-categories-list').innerHTML = sorted.length
    ? sorted.map(([cat, amt], i) => {
        const pct = ((amt / total) * 100).toFixed(1);
        return `<div class="top-cat-item">
          <div class="top-cat-header">
            <span class="top-cat-name"><span style="color:${colors[i]}">■</span> ${cat}</span>
            <span class="top-cat-pct">${pct}% — ₹${amt.toFixed(0)}</span>
          </div>
          <div class="top-cat-bar-wrap">
            <div class="top-cat-bar-fill" style="width:${pct}%;background:${colors[i]}"></div>
          </div>
        </div>`;
      }).join('')
    : '<p class="muted-text">No expense data this month.</p>';
}

// ===== HEALTH SCORE =====
async function loadHealthScore() {
  try {
    const res  = await fetch(`${API_URL}/ai/health-score`, { headers: { 'Authorization': localStorage.getItem('token') } });
    const data = await res.json();
    document.getElementById('health-score-value').textContent     = data.score;
    document.getElementById('health-grade').textContent           = data.grade || '';
    document.getElementById('health-score-breakdown').textContent = data.breakdown;
    const offset = 264 - (264 * data.score / 100);
    document.getElementById('health-ring').style.strokeDashoffset = offset;
    document.getElementById('health-ring').style.stroke =
      data.score >= 75 ? '#10b981' : data.score >= 50 ? '#f59e0b' : '#ef4444';
  } catch {
    document.getElementById('health-score-breakdown').textContent = 'Score unavailable.';
  }
}

// ===== BUDGET =====
async function loadBudgets() {
  try {
    const res  = await fetch(`${API_URL}/budget/status`, { headers: { 'Authorization': localStorage.getItem('token') } });
    const data = await res.json();
    renderBudgets(data);
  } catch { showToast('Failed to load budgets', 'error'); }
}

function renderBudgets(budgets) {
  const list   = document.getElementById('budget-list');
  const alerts = document.getElementById('budget-overspend-alerts');
  alerts.innerHTML = '';
  if (!budgets.length) {
    list.innerHTML = `<div class="empty-state"><i class="fa fa-bullseye"></i><p>No budgets set yet. Click "Set Budget" to start.</p></div>`;
    return;
  }
  const catEmojis = { Food:'🍔', Transport:'🚗', Shopping:'🛍️', Entertainment:'🎬', Health:'💊', Education:'📚', Utilities:'💡', Other:'📦', Salary:'💰', Business:'💼' };
  list.innerHTML = budgets.map(b => {
    const cls   = b.percent >= 100 ? 'danger' : b.percent >= 75 ? 'warning' : 'safe';
    const emoji = catEmojis[b.category] || '📦';
    const rem   = b.overspent ? `Over by ₹${Math.abs(b.remaining).toFixed(0)}` : `₹${b.remaining.toFixed(0)} left`;
    return `
      <div class="budget-card">
        <div class="budget-card-header">
          <div class="budget-cat"><span class="budget-cat-emoji">${emoji}</span>${b.category}</div>
          <button class="budget-delete" onclick="deleteBudget('${b._id}')"><i class="fa fa-trash"></i></button>
        </div>
        <div class="budget-amounts">
          <span>Spent: <strong>₹${b.spent.toFixed(0)}</strong></span>
          <span>Limit: <strong>₹${b.limit.toFixed(0)}</strong></span>
        </div>
        <div class="budget-bar"><div class="budget-bar-fill ${cls}" style="width:${b.percent}%"></div></div>
        <div class="budget-footer">
          <span class="budget-remaining ${b.overspent ? 'over' : ''}">${rem}</span>
          <span class="budget-percent ${cls}">${b.percent}%</span>
        </div>
        ${b.overspent ? `<div class="budget-ai-warning" id="warn-${b._id}">⚠️ Loading AI warning...</div>` : ''}
      </div>`;
  }).join('');
  budgets.filter(b => b.overspent).forEach(b => getBudgetAIWarning(b));
}

async function getBudgetAIWarning(b) {
  try {
    const res = await fetch(`${API_URL}/ai/budget-warning`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('token') },
      body: JSON.stringify({ category: b.category, spent: b.spent, limit: b.limit })
    });
    const data = await res.json();
    const el   = document.getElementById(`warn-${b._id}`);
    if (el) el.textContent = data.warning;
  } catch {}
}

async function saveBudget(e) {
  e.preventDefault();
  const category = document.getElementById('budget-category').value;
  const limit    = parseFloat(document.getElementById('budget-limit').value);
  try {
    const res = await fetch(`${API_URL}/budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('token') },
      body: JSON.stringify({ category, limit })
    });
    if (res.ok) { closeBudgetModal(); showToast('✅ Budget saved!', 'success'); loadBudgets(); }
    else showToast('Failed to save budget', 'error');
  } catch { showToast('Server error.', 'error'); }
}

async function deleteBudget(id) {
  try {
    const res = await fetch(`${API_URL}/budget/${id}`, { method: 'DELETE', headers: { 'Authorization': localStorage.getItem('token') } });
    if (res.ok) { showToast('Budget deleted', 'success'); loadBudgets(); }
  } catch { showToast('Failed', 'error'); }
}

function openBudgetModal()  { document.getElementById('budget-modal-overlay').classList.remove('hidden'); }
function closeBudgetModal() {
  document.getElementById('budget-modal-overlay').classList.add('hidden');
  document.getElementById('budget-limit').value = '';
}
function closeBudgetModalOutside(e) { if (e.target === document.getElementById('budget-modal-overlay')) closeBudgetModal(); }

// ===== GOALS =====
async function loadGoals() {
  try {
    const res   = await fetch(`${API_URL}/goals`, { headers: { 'Authorization': localStorage.getItem('token') } });
    const goals = await res.json();
    renderGoals(goals);
    if (goals.length) loadGoalAdvice(goals);
  } catch { showToast('Failed to load goals', 'error'); }
}

function renderGoals(goals) {
  const list = document.getElementById('goals-list');
  if (!goals.length) {
    list.innerHTML = `<div class="empty-state"><i class="fa fa-trophy"></i><p>No goals yet. Click "New Goal" to start saving!</p></div>`;
    return;
  }
  list.innerHTML = goals.map(g => {
    const pct  = Math.min(Math.round((g.savedAmount / g.targetAmount) * 100), 100);
    const done = pct >= 100;
    const dl   = g.deadline ? `📅 Deadline: ${new Date(g.deadline).toLocaleDateString('en-IN')}` : '';
    return `
      <div class="goal-card ${done ? 'goal-completed' : ''}">
        <div class="goal-card-header">
          <div class="goal-title-row">
            <span class="goal-emoji">${g.emoji || '🎯'}</span>
            <span class="goal-title">${escapeHTML(g.title)}</span>
          </div>
          <div class="goal-actions">
            <button class="t-delete" onclick="deleteGoal('${g._id}')"><i class="fa fa-trash"></i></button>
          </div>
        </div>
        ${dl ? `<div class="goal-deadline">${dl}</div>` : ''}
        <div class="goal-amounts">
          <span class="goal-saved-amt">Saved: ₹${g.savedAmount.toFixed(0)}</span>
          <span class="goal-target-amt">Goal: ₹${g.targetAmount.toFixed(0)}</span>
        </div>
        <div class="goal-bar"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
        <div class="goal-pct">${done ? '🎉 Goal reached!' : `<span>${pct}%</span> complete`}</div>
        ${!done ? `<button class="btn-add-to-goal" onclick="openAddToGoal('${g._id}')">
          <i class="fa fa-plus"></i> Add Savings
        </button>` : ''}
      </div>`;
  }).join('');
}

async function loadGoalAdvice(goals) {
  const box = document.getElementById('goal-advice');
  box.classList.remove('hidden');
  box.textContent = '🤖 Loading AI advice...';
  try {
    const res  = await fetch(`${API_URL}/ai/goal-advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('token') },
      body: JSON.stringify({ goals })
    });
    const data = await res.json();
    box.textContent = data.advice || '🎯 Keep saving consistently!';
  } catch { box.classList.add('hidden'); }
}

async function saveGoal(e) {
  e.preventDefault();
  const title        = document.getElementById('goal-title').value.trim();
  const targetAmount = parseFloat(document.getElementById('goal-target').value);
  const savedAmount  = parseFloat(document.getElementById('goal-saved').value) || 0;
  const deadline     = document.getElementById('goal-deadline').value || null;
  const emoji        = document.getElementById('goal-emoji').value    || '🎯';
  try {
    const res = await fetch(`${API_URL}/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('token') },
      body: JSON.stringify({ title, targetAmount, savedAmount, deadline, emoji })
    });
    if (res.ok) { closeGoalModal(); showToast('🎯 Goal created!', 'success'); loadGoals(); }
    else showToast('Failed to create goal', 'error');
  } catch { showToast('Server error.', 'error'); }
}

async function deleteGoal(id) {
  try {
    const res = await fetch(`${API_URL}/goals/${id}`, { method: 'DELETE', headers: { 'Authorization': localStorage.getItem('token') } });
    if (res.ok) { showToast('Goal deleted', 'success'); loadGoals(); }
  } catch { showToast('Failed', 'error'); }
}

function openAddToGoal(id) {
  document.getElementById('add-goal-id').value     = id;
  document.getElementById('add-goal-amount').value = '';
  document.getElementById('add-to-goal-overlay').classList.remove('hidden');
}
function closeAddToGoal() { document.getElementById('add-to-goal-overlay').classList.add('hidden'); }
function closeAddToGoalOutside(e) { if (e.target === document.getElementById('add-to-goal-overlay')) closeAddToGoal(); }

async function confirmAddToGoal() {
  const id  = document.getElementById('add-goal-id').value;
  const add = parseFloat(document.getElementById('add-goal-amount').value);
  if (!add || add <= 0) { showToast('Enter a valid amount', 'error'); return; }
  try {
    const goalsRes = await fetch(`${API_URL}/goals`, { headers: { 'Authorization': localStorage.getItem('token') } });
    const goals    = await goalsRes.json();
    const g        = goals.find(x => x._id === id);
    if (!g) return;
    const res = await fetch(`${API_URL}/goals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('token') },
      body: JSON.stringify({ savedAmount: (g.savedAmount || 0) + add })
    });
    if (res.ok) { closeAddToGoal(); showToast(`✅ ₹${add} added to goal!`, 'success'); loadGoals(); }
  } catch { showToast('Failed', 'error'); }
}

function openGoalModal()  { document.getElementById('goal-modal-overlay').classList.remove('hidden'); }
function closeGoalModal() {
  document.getElementById('goal-modal-overlay').classList.add('hidden');
  document.getElementById('goal-title').value    = '';
  document.getElementById('goal-target').value   = '';
  document.getElementById('goal-saved').value    = '0';
  document.getElementById('goal-deadline').value = '';
  document.getElementById('goal-emoji').value    = '🎯';
}
function closeGoalModalOutside(e) { if (e.target === document.getElementById('goal-modal-overlay')) closeGoalModal(); }

// ===== RECURRING =====
async function loadRecurring() {
  try {
    const res   = await fetch(`${API_URL}/recurring`, { headers: { 'Authorization': localStorage.getItem('token') } });
    const items = await res.json();
    renderRecurring(items);
  } catch { showToast('Failed to load recurring', 'error'); }
}

function renderRecurring(items) {
  const list = document.getElementById('recurring-list');
  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><i class="fa fa-rotate"></i><p>No recurring transactions yet.</p></div>`;
    return;
  }
  list.innerHTML = items.map(item => {
    const isIncome = item.amount > 0;
    return `
      <div class="recurring-card">
        <div class="recurring-header">
          <div class="recurring-title">
            <span>${item.emoji || '🔄'}</span>
            <span>${escapeHTML(item.text)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:.5rem">
            <span class="recurring-badge ${isIncome ? 'income' : 'expense'}">${isIncome ? 'Income' : 'Expense'}</span>
            <button class="recurring-delete" onclick="deleteRecurring('${item._id}')"><i class="fa fa-trash"></i></button>
          </div>
        </div>
        <div class="recurring-amount ${isIncome ? 'income' : 'expense'}">
          ${isIncome ? '+' : '-'}${formatCurrency(Math.abs(item.amount))}
        </div>
        <div class="recurring-info">
          <span>📂 ${item.category || 'Other'}</span>
          <span>📅 Auto-adds on day <strong>${item.dayOfMonth}</strong> of each month</span>
          ${item.lastProcessed
            ? `<span>✅ Last added: ${new Date(item.lastProcessed).toLocaleDateString('en-IN')}</span>`
            : '<span>⏳ Not yet processed this month</span>'}
        </div>
      </div>`;
  }).join('');
}

async function saveRecurring(e) {
  e.preventDefault();
  const text       = document.getElementById('rec-text').value.trim();
  const amount     = parseFloat(document.getElementById('rec-amount').value);
  const type       = document.getElementById('rec-type').value;
  const category   = document.getElementById('rec-category').value;
  const dayOfMonth = parseInt(document.getElementById('rec-day').value);
  const emojiMap   = { Salary:'💰', Food:'🍔', Transport:'🚗', Utilities:'💡', Shopping:'🛍️', Entertainment:'🎬', Health:'💊', Education:'📚', Business:'💼', Other:'🔄' };
  try {
    const res = await fetch(`${API_URL}/recurring`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('token') },
      body: JSON.stringify({ text, amount, type, category, emoji: emojiMap[category] || '🔄', dayOfMonth })
    });
    if (res.ok) { closeRecurringModal(); showToast('🔄 Recurring added!', 'success'); loadRecurring(); }
    else showToast('Failed to save', 'error');
  } catch { showToast('Server error.', 'error'); }
}

async function deleteRecurring(id) {
  try {
    const res = await fetch(`${API_URL}/recurring/${id}`, { method: 'DELETE', headers: { 'Authorization': localStorage.getItem('token') } });
    if (res.ok) { showToast('Recurring deleted', 'success'); loadRecurring(); }
  } catch { showToast('Failed', 'error'); }
}

async function processRecurring() {
  try {
    const res  = await fetch(`${API_URL}/recurring/process`, { method: 'POST', headers: { 'Authorization': localStorage.getItem('token') } });
    const data = await res.json();
    if (data.count > 0) { showToast(`🔄 ${data.count} recurring transaction(s) auto-added!`, 'success'); loadTransactions(); }
  } catch {}
}

function setRecurringType(type) {
  document.getElementById('rec-type').value = type;
  document.getElementById('rec-incomeBtn').classList.toggle('active',  type === 'income');
  document.getElementById('rec-expenseBtn').classList.toggle('active', type === 'expense');
}
function openRecurringModal()  { document.getElementById('recurring-modal-overlay').classList.remove('hidden'); }
function closeRecurringModal() {
  document.getElementById('recurring-modal-overlay').classList.add('hidden');
  document.getElementById('rec-text').value   = '';
  document.getElementById('rec-amount').value = '';
  document.getElementById('rec-day').value    = '1';
  setRecurringType('income');
}
function closeRecurringModalOutside(e) { if (e.target === document.getElementById('recurring-modal-overlay')) closeRecurringModal(); }

// ===== PROFILE =====
async function loadProfile() {
  try {
    const res  = await fetch(`${API_URL}/profile`, { headers: { 'Authorization': localStorage.getItem('token') } });
    const data = await res.json();
    document.getElementById('profile-name').value                = data.name  || '';
    document.getElementById('profile-email').value               = data.email || '';
    document.getElementById('profile-display-name').textContent  = data.name  || 'User';
    document.getElementById('profile-display-email').textContent = data.email || '';
    document.getElementById('profile-avatar-big').textContent    = (data.name || 'U')[0].toUpperCase();
    const toggle = document.getElementById('email-notif-toggle');
    if (toggle) toggle.checked = data.emailNotifications !== false;
  } catch {}
}

async function saveProfile(e) {
  e.preventDefault();
  const name            = document.getElementById('profile-name').value.trim();
  const email           = document.getElementById('profile-email').value.trim();
  const currentPassword = document.getElementById('profile-current-pass').value;
  const newPassword     = document.getElementById('profile-new-pass').value;
  const msg             = document.getElementById('profile-msg');
  msg.className   = 'auth-msg';
  msg.textContent = 'Saving...';
  try {
    const body = { name, email };
    if (currentPassword && newPassword) { body.currentPassword = currentPassword; body.newPassword = newPassword; }
    const res  = await fetch(`${API_URL}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('token') },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('userName', data.name);
      document.getElementById('user-name-display').textContent        = data.name;
      document.getElementById('user-avatar').textContent              = data.name[0].toUpperCase();
      document.getElementById('profile-display-name').textContent     = data.name;
      document.getElementById('profile-avatar-big').textContent       = data.name[0].toUpperCase();
      msg.className   = 'auth-msg success';
      msg.textContent = '✓ Profile updated!';
      document.getElementById('profile-current-pass').value = '';
      document.getElementById('profile-new-pass').value     = '';
    } else { msg.textContent = data.message || 'Failed to update.'; }
  } catch { msg.textContent = 'Server error.'; }
}

async function toggleEmailNotifications(checked) {
  try {
    await fetch(`${API_URL}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('token') },
      body: JSON.stringify({ emailNotifications: checked })
    });
    showToast(checked ? '📧 Weekly emails enabled!' : '🔕 Emails disabled', 'success');
  } catch { showToast('Failed to update', 'error'); }
}

async function sendWeeklySummaryNow() {
  showToast('📤 Sending summary...', 'success');
  try {
    const res  = await fetch(`${API_URL}/email/send-weekly`, { method: 'POST', headers: { 'Authorization': localStorage.getItem('token') } });
    const data = await res.json();
    showToast(res.ok ? '✅ ' + data.message : '❌ ' + data.message, res.ok ? 'success' : 'error');
  } catch { showToast('Failed to send email', 'error'); }
}

async function sendTestEmail() {
  showToast('📧 Sending test email...', 'success');
  try {
    const res  = await fetch(`${API_URL}/email/test`, { method: 'POST', headers: { 'Authorization': localStorage.getItem('token') } });
    const data = await res.json();
    showToast(res.ok ? '✅ ' + data.message : '❌ ' + data.message, res.ok ? 'success' : 'error');
  } catch { showToast('Failed to send test email', 'error'); }
}

// ===== AI WIDGETS =====
async function loadWeeklySummary() {
  try {
    const res  = await fetch(`${API_URL}/ai/weekly-summary`, { headers: { 'Authorization': localStorage.getItem('token') } });
    const data = await res.json();
    document.getElementById('weekly-summary-text').textContent = data.summary || 'No transactions this week yet.';
  } catch { document.getElementById('weekly-summary-text').textContent = 'Weekly summary unavailable.'; }
}

async function loadDailyTip() {
  try {
    const res  = await fetch(`${API_URL}/ai/daily-tip`, { headers: { 'Authorization': localStorage.getItem('token') } });
    const data = await res.json();
    document.getElementById('daily-tip-text').textContent = data.tip || '💡 Track every rupee!';
  } catch { document.getElementById('daily-tip-text').textContent = '💡 Track every rupee to build better habits!'; }
}

async function loadAlerts() {
  try {
    const res  = await fetch(`${API_URL}/ai/alerts`, { headers: { 'Authorization': localStorage.getItem('token') } });
    const data = await res.json();
    const cont = document.getElementById('alerts-container');
    cont.innerHTML = '';
    const iconMap = { warning: 'fa-triangle-exclamation', info: 'fa-circle-info', success: 'fa-circle-check' };
    (data.alerts || []).forEach(alert => {
      const div = document.createElement('div');
      div.className = `alert-item ${alert.type || 'info'}`;
      div.innerHTML = `<i class="fa ${iconMap[alert.type] || 'fa-circle-info'}"></i><span>${alert.message}</span><span class="alert-dismiss" onclick="this.parentElement.remove()">✕</span>`;
      cont.appendChild(div);
    });
  } catch {}
}

// ===== AI CHAT =====
function toggleAIChat() {
  const panel = document.getElementById('ai-chat-panel');
  const icon  = document.getElementById('ai-fab-icon');
  panel.classList.toggle('hidden');
  icon.className = panel.classList.contains('hidden') ? 'fa-solid fa-robot' : 'fa fa-times';
}

async function analyzeFinances() {
  addAIMessage('Analyze my finances and give me specific actionable suggestions.', 'user');
  showTyping();
  try {
    const res  = await fetch(`${API_URL}/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('token') },
      body: JSON.stringify({ message: 'Analyze my finances and give specific suggestions.' })
    });
    const data = await res.json();
    removeTyping();
    addAIMessage(data.reply || 'Could not analyze right now.', 'bot');
  } catch { removeTyping(); addAIMessage('Analysis failed. Try again.', 'bot'); }
}

async function generateMonthlyReport() {
  addAIMessage('Generate my monthly financial report.', 'user');
  showTyping();
  try {
    const res  = await fetch(`${API_URL}/ai/monthly-report`, { headers: { 'Authorization': localStorage.getItem('token') } });
    const data = await res.json();
    removeTyping();
    const stats = data.stats
      ? `\n\n📊 Income: ₹${data.stats.income} | Expenses: ₹${data.stats.expense} | Saved: ₹${data.stats.saved} | Transactions: ${data.stats.count}`
      : '';
    addAIMessage((data.reply || 'Report unavailable.') + stats, 'bot');
  } catch { removeTyping(); addAIMessage('Report generation failed.', 'bot'); }
}

async function getPrediction() {
  addAIMessage('Predict my expenses for next month.', 'user');
  showTyping();
  try {
    const res  = await fetch(`${API_URL}/ai/predict`, { headers: { 'Authorization': localStorage.getItem('token') } });
    const data = await res.json();
    removeTyping();
    addAIMessage(data.reply || 'Prediction unavailable.', 'bot');
  } catch { removeTyping(); addAIMessage('Prediction unavailable.', 'bot'); }
}

async function sendAIMessage() {
  const input   = document.getElementById('ai-input');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  addAIMessage(message, 'user');
  showTyping();
  try {
    const res  = await fetch(`${API_URL}/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('token') },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    removeTyping();
    addAIMessage(data.reply || 'No response.', 'bot');
  } catch { removeTyping(); addAIMessage('Something went wrong. Try again.', 'bot'); }
}

function addAIMessage(text, sender) {
  const win     = document.getElementById('ai-chat-window');
  const welcome = win.querySelector('.ai-welcome-msg');
  if (welcome) welcome.remove();
  const icon = sender === 'bot' ? '<i class="fa-solid fa-robot"></i>' : '<i class="fa fa-user"></i>';
  const div  = document.createElement('div');
  div.className = `ai-msg ${sender}`;
  div.innerHTML = `<div class="ai-msg-avatar">${icon}</div><div class="ai-msg-bubble">${escapeHTML(text)}</div>`;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}

function showTyping() {
  const win = document.getElementById('ai-chat-window');
  const div = document.createElement('div');
  div.className = 'ai-typing'; div.id = 'typing-indicator';
  div.innerHTML = `
    <div style="width:28px;height:28px;border-radius:50%;background:rgba(124,58,237,.2);color:var(--accent2);display:flex;align-items:center;justify-content:center;font-size:.72rem;flex-shrink:0;">
      <i class="fa-solid fa-robot"></i>
    </div>
    <div class="ai-typing-dots"><span></span><span></span><span></span></div>`;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}
function removeTyping() { document.getElementById('typing-indicator')?.remove(); }

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className   = `toast ${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ===== UTILS =====
function formatCurrency(amount) {
  return '₹' + Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function escapeHTML(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  if (localStorage.getItem('token')) showDashboard();
});
