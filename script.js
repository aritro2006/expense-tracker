const API_URL = 'https://your-render-service.onrender.com/api';
// ↑ Replace with your actual Render backend URL

let allTransactions = [];
let currentType = 'income';
let barChartInstance = null;
let donutChartInstance = null;

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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok) { msg.className = 'auth-msg success'; msg.textContent = '✓ Account created! Please login.'; setTimeout(() => switchTab('login'), 1500); }
    else msg.textContent = data.message || 'Registration failed.';
  } catch { msg.textContent = 'Server error. Try again.'; }
}

async function loginUser(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('login-msg');
  msg.className = 'auth-msg'; msg.textContent = 'Logging in...';
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('userName', data.name || email.split('@')[0]);
      showDashboard();
    } else msg.textContent = data.message || 'Invalid credentials.';
  } catch { msg.textContent = 'Server error. Try again.'; }
}

function logout() {
  localStorage.removeItem('token'); localStorage.removeItem('userName');
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
  document.getElementById('greeting-text').textContent = `${greet}, ${localStorage.getItem('userName') || 'User'} 👋`;
}

// ===== TRANSACTIONS =====
async function loadTransactions() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/transactions`, { headers: { 'Authorization': token } });
    const data = await res.json();
    if (res.ok) { allTransactions = data; renderAll(data); }
    else if (res.status === 401) logout();
  } catch { showToast('Failed to load transactions', 'error'); }
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

function renderTransactionList(transactions) {
  const list = document.getElementById('transaction-list');
  if (transactions.length === 0) {
    list.innerHTML = `<div class="empty-state"><i class="fa fa-inbox"></i><p>No transactions found.</p></div>`;
    return;
  }
  list.innerHTML = transactions.slice().reverse().map(t => {
    const isIncome = t.amount > 0;
    const date = new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const emoji = t.emoji || (isIncome ? '💰' : '💸');
    const category = t.category || '';
    return `
      <div class="transaction-item" id="t-${t._id}">
        <div class="t-icon ${isIncome ? 'income' : 'expense'}" style="font-size:1.4rem">${emoji}</div>
        <div class="t-details">
          <strong>${escapeHTML(t.text)}</strong>
          <small>${date}${category ? ` · ${category}` : ''}</small>
        </div>
        <span class="t-amount ${isIncome ? 'income' : 'expense'}">${isIncome ? '+' : '-'}${formatCurrency(Math.abs(t.amount))}</span>
        <button class="t-delete" onclick="deleteTransaction('${t._id}')"><i class="fa fa-trash"></i></button>
      </div>`;
  }).join('');
}

function filterTransactions(type, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  let filtered = allTransactions;
  if (type === 'income') filtered = allTransactions.filter(t => t.amount > 0);
  if (type === 'expense') filtered = allTransactions.filter(t => t.amount < 0);
  renderTransactionList(filtered);
}

async function addTransaction(e) {
  e.preventDefault();
  const text = document.getElementById('t-text').value.trim();
  const rawAmount = parseFloat(document.getElementById('t-amount').value);
  const type = document.getElementById('t-type').value;
  const amount = type === 'expense' ? -Math.abs(rawAmount) : Math.abs(rawAmount);
  const token = localStorage.getItem('token');

  let category = 'Other', emoji = type === 'income' ? '💰' : '💸';
  try {
    const catRes = await fetch(`${API_URL}/ai/categorize`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token },
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
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ text, amount, category, emoji })
    });
    const data = await res.json();
    if (res.ok) { closeModal(); showToast(`${emoji} Transaction added!`, 'success'); loadTransactions(); }
    else showToast(data.message || 'Failed to add', 'error');
  } catch { showToast('Server error.', 'error'); }
}

async function deleteTransaction(id) {
  const token = localStorage.getItem('token');
  const item = document.getElementById(`t-${id}`);
  if (item) item.style.opacity = '0.4';
  try {
    const res = await fetch(`${API_URL}/transactions/${id}`, { method: 'DELETE', headers: { 'Authorization': token } });
    if (res.ok) { showToast('Transaction deleted', 'success'); loadTransactions(); }
    else { if (item) item.style.opacity = '1'; showToast('Failed to delete', 'error'); }
  } catch { if (item) item.style.opacity = '1'; }
}

// ===== SMART AI INPUT =====
async function parseSmartInput() {
  const smartInput = document.getElementById('smart-input');
  const text = smartInput.value.trim();
  if (!text) { showToast('Type something first!', 'error'); return; }
  const btn = document.querySelector('.btn-smart');
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
  btn.disabled = true;
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/ai/parse-transaction`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (data.text) document.getElementById('t-text').value = data.text;
    if (data.amount) document.getElementById('t-amount').value = data.amount;
    if (data.type) setType(data.type);
    smartInput.value = '';
    showToast('✨ Form filled by AI!', 'success');
  } catch { showToast('Smart input failed', 'error'); }
  btn.innerHTML = '<i class="fa fa-wand-magic-sparkles"></i>';
  btn.disabled = false;
}

// ===== CHARTS =====
function renderCharts(transactions) {
  const income = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  if (barChartInstance) barChartInstance.destroy();
  barChartInstance = new Chart(document.getElementById('barChart').getContext('2d'), {
    type: 'bar',
    data: { labels: ['Income', 'Expenses'], datasets: [{ data: [income, expense], backgroundColor: ['rgba(16,185,129,0.7)', 'rgba(239,68,68,0.7)'], borderColor: ['#10b981', '#ef4444'], borderWidth: 2, borderRadius: 10, borderSkipped: false }] },
    options: { responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ₹${ctx.raw.toFixed(2)}` } } }, scales: { x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#94a3b8', callback: v => `₹${v}` }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
  });

  if (donutChartInstance) donutChartInstance.destroy();
  donutChartInstance = new Chart(document.getElementById('donutChart').getContext('2d'), {
    type: 'doughnut',
    data: { labels: ['Income', 'Expenses'], datasets: [{ data: [income || 0.001, expense || 0.001], backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(239,68,68,0.8)'], borderColor: ['#10b981', '#ef4444'], borderWidth: 2, hoverOffset: 8 }] },
    options: { responsive: true, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 20, font: { family: 'Inter' }, usePointStyle: true } }, tooltip: { callbacks: { label: ctx => ` ₹${ctx.raw.toFixed(2)}` } } } }
  });
}

// ===== MODAL =====
function openModal() { document.getElementById('modal-overlay').classList.remove('hidden'); document.getElementById('t-text').focus(); }
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('t-text').value = '';
  document.getElementById('t-amount').value = '';
  document.getElementById('smart-input').value = '';
  document.getElementById('category-display').classList.add('hidden');
  setType('income');
}
function closeModalOutside(e) { if (e.target === document.getElementById('modal-overlay')) closeModal(); }
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
    const res = await fetch(`${API_URL}/ai/weekly-summary`, { headers: { 'Authorization': token } });
    const data = await res.json();
    document.getElementById('weekly-summary-text').textContent = data.summary || 'No transactions this week yet.';
  } catch { document.getElementById('weekly-summary-text').textContent = 'Weekly summary unavailable.'; }
}

// ===== DAILY TIP =====
async function loadDailyTip() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/ai/daily-tip`, { headers: { 'Authorization': token } });
    const data = await res.json();
    document.getElementById('daily-tip-text').textContent = data.tip || '💡 Keep tracking your expenses!';
  } catch { document.getElementById('daily-tip-text').textContent = '💡 Track every rupee to build better habits!'; }
}

// ===== SMART ALERTS =====
async function loadAlerts() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/ai/alerts`, { headers: { 'Authorization': token } });
    const data = await res.json();
    const container = document.getElementById('alerts-container');
    container.innerHTML = '';
    const iconMap = { warning: 'fa-triangle-exclamation', info: 'fa-circle-info', success: 'fa-circle-check' };
    (data.alerts || []).forEach(alert => {
      const div = document.createElement('div');
      div.className = `alert-item ${alert.type || 'info'}`;
      div.innerHTML = `<i class="fa ${iconMap[alert.type] || 'fa-circle-info'}"></i><span>${alert.message}</span><span class="alert-dismiss" onclick="this.parentElement.remove()">✕</span>`;
      container.appendChild(div);
    });
  } catch {}
}

// ===== AI BUBBLE =====
function toggleAIChat() {
  const panel = document.getElementById('ai-chat-panel');
  const icon = document.getElementById('ai-fab-icon');
  panel.classList.toggle('hidden');
  icon.className = panel.classList.contains('hidden') ? 'fa-solid fa-robot' : 'fa fa-times';
}

// ===== AI CHAT FUNCTIONS =====
async function analyzeFinances() {
  addAIMessage('Analyze my finances and give me 3-5 specific actionable suggestions.', 'user');
  showTyping();
  try {
    const res = await fetch(`${API_URL}/ai/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('token') },
      body: JSON.stringify({ message: 'Analyze my finances and give specific suggestions.' })
    });
    const data = await res.json();
    removeTyping(); addAIMessage(data.reply, 'bot');
  } catch { removeTyping(); addAIMessage('Analysis failed. Try again.', 'bot'); }
}

async function generateMonthlyReport() {
  addAIMessage('Generate my monthly financial report.', 'user');
  showTyping();
  try {
    const res = await fetch(`${API_URL}/ai/monthly-report`, { headers: { 'Authorization': localStorage.getItem('token') } });
    const data = await res.json();
    removeTyping();
    const stats = data.stats ? `\n\n📊 Income: ₹${data.stats.income} | Expenses: ₹${data.stats.expense} | Saved: ₹${data.stats.saved} | Transactions: ${data.stats.count}` : '';
    addAIMessage(data.reply + stats, 'bot');
  } catch { removeTyping(); addAIMessage('Report generation failed.', 'bot'); }
}

async function getPrediction() {
  addAIMessage('Predict my expenses for next month.', 'user');
  showTyping();
  try {
    const res = await fetch(`${API_URL}/ai/predict`, { headers: { 'Authorization': localStorage.getItem('token') } });
    const data = await res.json();
    removeTyping(); addAIMessage(data.reply, 'bot');
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
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('token') },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    removeTyping(); addAIMessage(data.reply, 'bot');
  } catch { removeTyping(); addAIMessage('Something went wrong.', 'bot'); }
}

function addAIMessage(text, sender) {
  const win = document.getElementById('ai-chat-window');
  const welcome = win.querySelector('.ai-welcome-msg');
  if (welcome) welcome.remove();
  const icon = sender === 'bot' ? '<i class="fa-solid fa-robot"></i>' : '<i class="fa fa-user"></i>';
  const div = document.createElement('div');
  div.className = `ai-msg ${sender}`;
  div.innerHTML = `<div class="ai-msg-avatar">${icon}</div><div class="ai-msg-bubble">${text}</div>`;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}

function showTyping() {
  const win = document.getElementById('ai-chat-window');
  const div = document.createElement('div');
  div.className = 'ai-typing'; div.id = 'typing-indicator';
  div.innerHTML = `<div class="ai-msg-avatar" style="background:rgba(124,58,237,0.2);color:var(--accent2);width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.72rem;flex-shrink:0"><i class="fa-solid fa-robot"></i></div><div class="ai-typing-dots"><span></span><span></span><span></span></div>`;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}
function removeTyping() { document.getElementById('typing-indicator')?.remove(); }

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = type === 'success' ? `✓ ${msg}` : `✕ ${msg}`;
  toast.className = `toast ${type}`;
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ===== UTILS =====
function formatCurrency(amount) {
  return '₹' + Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('token')) showDashboard();
});
