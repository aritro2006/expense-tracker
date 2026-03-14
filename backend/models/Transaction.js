const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true
  },
  text: {
    type:     String,
    required: true,
    trim:     true
  },
  amount: {
    type:     Number,
    required: true
  },
  category: {
    type:    String,
    default: 'Other'
  },
  emoji: {
    type:    String,
    default: '💰'
  },
  notes: {
    type:    String,
    default: ''
  },
  account: {
    type:    String,
    default: 'Main'
  },
  date: {
    type:    Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', TransactionSchema);
