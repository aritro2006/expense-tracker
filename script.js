const balanceEl = document.getElementById("balance");
const incomeEl = document.getElementById("income");
const expenseEl = document.getElementById("expense");
const list = document.getElementById("transaction-list");
const form = document.getElementById("transaction-form");

const text = document.getElementById("text");
const amount = document.getElementById("amount");
const type = document.getElementById("type");
const category = document.getElementById("category");

const monthFilter = document.getElementById("monthFilter");
const yearFilter = document.getElementById("yearFilter");
const themeSwitch = document.getElementById("themeSwitch");

let transactions = JSON.parse(localStorage.getItem("transactions")) || [];
let editId = null;
let chart;

/* ---------- THEME ---------- */
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
  themeSwitch.checked = true;
}

themeSwitch.addEventListener("change", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "theme",
    document.body.classList.contains("dark") ? "dark" : "light"
  );
});

/* ---------- ADD / EDIT ---------- */
form.addEventListener("submit", e => {
  e.preventDefault();

  const desc = text.value.trim();
  const val = Number(amount.value);
  if (!desc || isNaN(val) || val === 0) return;

  const signedAmount =
    type.value === "expense" ? -Math.abs(val) : Math.abs(val);

  if (editId) {
    transactions = transactions.map(t =>
      t.id === editId
        ? { ...t, text: desc, amount: signedAmount, category: category.value }
        : t
    );
    editId = null;
  } else {
    transactions.push({
      id: Date.now(),
      text: desc,
      amount: signedAmount,
      category: category.value
    });
  }

  localStorage.setItem("transactions", JSON.stringify(transactions));
  form.reset();
  init();
});

/* ---------- DELETE ---------- */
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  localStorage.setItem("transactions", JSON.stringify(transactions));
  init();
}

/* ---------- EDIT ---------- */
function editTransaction(t) {
  text.value = t.text;
  amount.value = Math.abs(t.amount);
  type.value = t.amount < 0 ? "expense" : "income";
  category.value = t.category;
  editId = t.id;
}

/* ---------- FILTER ---------- */
function getFilteredTransactions() {
  return transactions.filter(t => {
    const d = new Date(t.id);
    const m = monthFilter.value === "" || d.getMonth() == monthFilter.value;
    const y = yearFilter.value === "" || d.getFullYear() == yearFilter.value;
    return m && y;
  });
}

/* ---------- UI ---------- */
function init() {
  list.innerHTML = "";

  const filtered = getFilteredTransactions();
  let income = 0, expense = 0;

  filtered.forEach(t => {
    const li = document.createElement("li");
    li.className = t.amount < 0 ? "minus" : "plus";

    li.innerHTML = `
      ${t.text} (${t.category})
      <span>₹${Math.abs(t.amount)}</span>
      <div class="actions">
        <button onclick='editTransaction(${JSON.stringify(t)})'>✏️</button>
        <button onclick='deleteTransaction(${t.id})'>❌</button>
      </div>
    `;

    list.appendChild(li);

    t.amount > 0 ? (income += t.amount) : (expense += t.amount);
  });

  balanceEl.innerText = `₹${income + expense}`;
  incomeEl.innerText = `₹${income}`;
  expenseEl.innerText = `₹${Math.abs(expense)}`;

  populateYears();
  renderChart(income, Math.abs(expense));
}

/* ---------- YEARS ---------- */
function populateYears() {
  const years = [...new Set(transactions.map(t => new Date(t.id).getFullYear()))];
  yearFilter.innerHTML = `<option value="">All Years</option>`;
  years.forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearFilter.appendChild(opt);
  });
}

/* ---------- CHART ---------- */
function renderChart(income, expense) {
  const ctx = document.getElementById("expenseChart");
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Income", "Expense"],
      datasets: [{
        data: [income, expense],
        backgroundColor: ["#2e7d32", "#c62828"]
      }]
    }
  });
}

monthFilter.addEventListener("change", init);
yearFilter.addEventListener("change", init);

init();
