const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/expense-tracker");

app.use("/api/transactions", require("./routes/transactions"));

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
