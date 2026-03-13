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
  msg.className = 'auth-msg';
  msg.textContent = 'Logging in...';
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) { localStorage.setItem('token', data.token); localStorage.setItem('userName', data.name || email.split('@')[0]); showDashboard(); }
    else msg.textContent = data.message || 'Invalid credentials.';
  } catch { msg.textContent = 'Server error. Try again.'; }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('userName');
  document.getElementById('dashboard-section').classList.add('hidden');
  document.getElementById('auth-section').style.display = 'flex';
  const panel = document.getElementById('ai-chat-panel');
  if (panel) panel.classList.add('hidden');
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
    return `
      <div class="transaction-item" id="t-${t._id}">
        <div class="t-icon ${isIncome ? 'income' : 'expense'}"><i class="fa ${isIncome ? 'fa-arrow-up' : 'fa-arrow-down'}"></i></div>
        <div class="t-details"><strong>${escapeHTML(t.text)}</strong><small>${date}</small></div>
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
  try {
    const res = await fetch(`${API_URL}/transactions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ text, amount })
    });
    const data = await res.json();
    if (res.ok) { closeModal(); showToast('Transaction added!', 'success'); loadTransactions(); }
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
  } catch { if (item) item.style.opacity = '1'; showToast('Server error.', 'error'); }
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
      datasets: [{ data: [income, expense], backgroundColor: ['rgba(16,185,129,0.7)', 'rgba(239,68,68,0.7)'], borderColor: ['#10b981', '#ef4444'], borderWidth: 2, borderRadius: 10, borderSkipped: false }]
    },
    options: { responsive: true, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ₹${ctx.raw.toFixed(2)}` } } }, scales: { x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#94a3b8', callback: v => `₹${v}` }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
  });

  if (donutChartInstance) donutChartInstance.destroy();
  donutChartInstance = new Chart(document.getElementById('donutChart').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{ data: [income || 0.001, expense || 0.001], backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(239,68,68,0.8)'], borderColor: ['#10b981', '#ef4444'], borderWidth: 2, hoverOffset: 8 }]
    },
    options: { responsive: true, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', padding: 20, font: { family: 'Inter' }, usePointStyle: true } }, tooltip: { callbacks: { label: ctx => ` ₹${ctx.raw.toFixed(2)}` } } } }
  });
}

// ===== MODAL =====
function openModal() { document.getElementById('modal-overlay').classList.remove('hidden'); document.getElementById('t-text').focus(); }
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); document.getElementById('t-text').value = ''; document.getElementById('t-amount').value = ''; setType('income'); }
function closeModalOutside(e) { if (e.target === document.getElementById('modal-overlay')) closeModal(); }
function setType(type) {
  currentType = type;
  document.getElementById('t-type').value = type;
  document.getElementById('incomeBtn').classList.toggle('active', type === 'income');
  document.getElementById('expenseBtn').classList.toggle('active', type === 'expense');
}

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = type === 'success' ? `✓ ${msg}` : `✕ ${msg}`;
  toast.className = `toast ${type}`;
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ===== AI BUBBLE =====
function toggleAIChat() {
  const panel = document.getElementById('ai-chat-panel');
  const icon = document.getElementById('ai-fab-icon');
  panel.classList.toggle('hidden');
  icon.className = panel.classList.contains('hidden') ? 'fa-solid fa-robot' : 'fa fa-times';
}

// ===== AI ASSISTANT =====
async function analyzeFinances() {
  const btn = document.querySelector('.btn-analyze-small');
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Analyzing...';
  btn.disabled = true;
  addAIMessage('Analyze my finances, identify spending patterns, and give me 3-5 specific actionable suggestions.', 'user');
  showTyping();
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/ai/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ message: 'Analyze my finances and give specific suggestions.' })
    });
    const data = await res.json();
    removeTyping();
    addAIMessage(data.reply, 'bot');
  } catch { removeTyping(); addAIMessage('Sorry, AI analysis failed. Please try again.', 'bot'); }
  btn.innerHTML = '<i class="fa fa-chart-line"></i> Analyze';
  btn.disabled = false;
}

async function sendAIMessage() {
  const input = document.getElementById('ai-input');
  const message = input.value.trim();
  if (!message) return;
  input.value = '';
  addAIMessage(message, 'user');
  showTyping();
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_URL}/ai/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    removeTyping();
    addAIMessage(data.reply, 'bot');
  } catch { removeTyping(); addAIMessage('Sorry, something went wrong.', 'bot'); }
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
  div.innerHTML = `<div class="ai-msg-avatar" style="background:rgba(124,58,237,0.2);color:var(--accent2);width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.75rem;"><i class="fa-solid fa-robot"></i></div><div class="ai-typing-dots"><span></span><span></span><span></span></div>`;
  win.appendChild(div);
  win.scrollTop = win.scrollHeight;
}

function removeTyping() { const el = document.getElementById('typing-indicator'); if (el) el.remove(); }

// ===== UTILS =====
function formatCurrency(amount) { return '₹' + Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function escapeHTML(str) { return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => { if (localStorage.getItem('token')) showDashboard(); });
