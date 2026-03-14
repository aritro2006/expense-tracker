const mongoose = require('mongoose');
const RecurringSchema = new mongoose.Schema({
  user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text:          { type: String, required: true },
  amount:        { type: Number, required: true },
  type:          { type: String, enum: ['income','expense'], required: true },
  category:      { type: String, default: 'Other' },
  emoji:         { type: String, default: '🔄' },
  dayOfMonth:    { type: Number, default: 1 },
  lastProcessed: { type: Date, default: null },
  active:        { type: Boolean, default: true }
});
module.exports = mongoose.model('Recurring', RecurringSchema);
