const mongoose = require('mongoose');
const TransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, default: 'Other' },
  emoji: { type: String, default: '💰' },
  date: { type: Date, default: Date.now }
});
module.exports = mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
