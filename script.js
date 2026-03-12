const API = "https://expense-tracker-shck.onrender.com/api";

let token = localStorage.getItem("token");

const balanceEl = document.getElementById("balance");
const incomeEl = document.getElementById("income");
const expenseEl = document.getElementById("expense");
const list = document.getElementById("transaction-list");

const form = document.getElementById("transaction-form");

if (token) {
document.getElementById("auth-section").style.display = "none";
document.getElementById("app-section").style.display = "block";
loadTransactions();
}

/* ================= AUTH ================= */

async function register(){

const username = document.getElementById("regUsername").value;
const email = document.getElementById("regEmail").value;
const password = document.getElementById("regPassword").value;

const res = await fetch(`${API}/auth/register`,{
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({username,email,password})
});

const data = await res.json();

if(data.token){
localStorage.setItem("token",data.token);
location.reload();
}else{
alert(data.message);
}

}

async function login(){

const email = document.getElementById("loginEmail").value;
const password = document.getElementById("loginPassword").value;

const res = await fetch(`${API}/auth/login`,{
method:"POST",
headers:{ "Content-Type":"application/json" },
body:JSON.stringify({email,password})
});

const data = await res.json();

if(data.token){
localStorage.setItem("token",data.token);
location.reload();
}else{
alert(data.message);
}

}

function logout(){
localStorage.removeItem("token");
location.reload();
}

/* ================= TRANSACTIONS ================= */

async function loadTransactions(){

const res = await fetch(`${API}/transactions`,{
headers:{
Authorization:`Bearer ${token}`
}
});

const transactions = await res.json();

renderTransactions(transactions);

}

async function addTransaction(text,amount,category){

await fetch(`${API}/transactions`,{
method:"POST",
headers:{
"Content-Type":"application/json",
Authorization:`Bearer ${token}`
},
body:JSON.stringify({text,amount,category})
});

loadTransactions();

}

async function deleteTransaction(id){

await fetch(`${API}/transactions/${id}`,{
method:"DELETE",
headers:{
Authorization:`Bearer ${token}`
}
});

loadTransactions();

}

/* ================= UI ================= */

function renderTransactions(transactions){

list.innerHTML="";

let income = 0;
let expense = 0;

transactions.forEach(t=>{

const li = document.createElement("li");

li.innerHTML = `
${t.text} (${t.category}) ₹${t.amount}
<button onclick="deleteTransaction('${t._id}')">❌</button>
`;

list.appendChild(li);

if(t.amount>0){
income += t.amount;
}else{
expense += t.amount;
}

});

balanceEl.innerText = `₹${income + expense}`;
incomeEl.innerText = income;
expenseEl.innerText = Math.abs(expense);

}

/* ================= FORM ================= */

form.addEventListener("submit",e=>{

e.preventDefault();

const text = document.getElementById("text").value;
const amount = Number(document.getElementById("amount").value);
const category = document.getElementById("category").value;

addTransaction(text,amount,category);

form.reset();

});