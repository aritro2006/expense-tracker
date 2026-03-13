require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const aiRoutes = require('./routes/ai');
const budgetRoutes = require('./routes/budget');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE', 'PUT'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

app.get('/', (req, res) => res.send('Expense Tracker API Running'));
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/budget', budgetRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
