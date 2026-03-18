const mongoose = require('mongoose');

const RecurringSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:     { type: String, required: true },
  amount:    { type: Number, required: true },
  category:  { type: String, required: true },
  frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'monthly' },
  nextDate:  { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Recurring', RecurringSchema);
