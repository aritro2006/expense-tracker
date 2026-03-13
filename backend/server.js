require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Expense Tracker API Running'));
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
