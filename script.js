const API_URL = "https://expense-tracker-shck.onrender.com/api/transactions";

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

let transactions = [];
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

/* ---------- FETCH TRANSACTIONS FROM BACKEND ---------- */
async function fetchTransactions() {
  try {
    const res = await fetch(API_URL);
    transactions = await res.json();
    init();
  } catch (err) {
    console.error("Error fetching transactions:", err);
  }
}

/* ---------- ADD / EDIT ---------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const desc = text.value.trim();
  const val = Number(amount.value);
  if (!desc || isNaN(val) || val === 0) return;

  const signedAmount =
    type.value === "expense" ? -Math.abs(val) : Math.abs(val);

  try {
    if (editId) {
      await fetch(`${API_URL}/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: desc,
          amount: signedAmount,
          category: category.value,
        }),
      });
      editId = null;
    } else {
      await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: desc,
          amount: signedAmount,
          category: category.value,
        }),
      });
    }

    form.reset();
    fetchTransactions();
  } catch (err) {
    console.error("Error saving transaction:", err);
  }
});

/* ---------- DELETE ---------- */
async function deleteTransaction(id) {
  try {
    await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    fetchTransactions();
  } catch (err) {
    console.error("Error deleting transaction:", err);
  }
}

/* ---------- EDIT ---------- */
function editTransaction(t) {
  text.value = t.text;
  amount.value = Math.abs(t.amount);
  type.value = t.amount < 0 ? "expense" : "income";
  category.value = t.category;
  editId = t._id;
}

/* ---------- FILTER ---------- */
function getFilteredTransactions() {
  return transactions.filter((t) => {
    const d = new Date(t.createdAt || t._id);
    const m =
      monthFilter.value === "" ||
      d.getMonth() == monthFilter.value;
    const y =
      yearFilter.value === "" ||
      d.getFullYear() == yearFilter.value;
    return m && y;
  });
}

/* ---------- UI ---------- */
function init() {
  list.innerHTML = "";

  const filtered = getFilteredTransactions();
  let income = 0,
    expense = 0;

  filtered.forEach((t) => {
    const li = document.createElement("li");
    li.className = t.amount < 0 ? "minus" : "plus";

    li.innerHTML = `
      ${t.text} (${t.category})
      <span>₹${Math.abs(t.amount)}</span>
      <div class="actions">
        <button onclick='editTransaction(${JSON.stringify(t)})'>✏️</button>
        <button onclick='deleteTransaction("${t._id}")'>❌</button>
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
  const years = [
    ...new Set(
      transactions.map((t) =>
        new Date(t.createdAt || t._id).getFullYear()
      )
    ),
  ];

  yearFilter.innerHTML = `<option value="">All Years</option>`;
  years.forEach((y) => {
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
      datasets: [
        {
          data: [income, expense],
          backgroundColor: ["#2e7d32", "#c62828"],
        },
      ],
    },
  });
}

monthFilter.addEventListener("change", init);
yearFilter.addEventListener("change", init);

/* ---------- INITIAL LOAD ---------- */
fetchTransactions();