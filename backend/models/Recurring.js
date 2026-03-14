const mongoose = require('mongoose');

const RecurringSchema = new mongoose.Schema({
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
    default: '🔄'
  },
  dayOfMonth: {
    type:    Number,
    default: 1
  },
  lastProcessed: {
    type: Date
  }
}, { timestamps: true });

module.exports = mongoose.model('Recurring', RecurringSchema);
