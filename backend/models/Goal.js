const mongoose = require('mongoose');

const GoalSchema = new mongoose.Schema({
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true
  },
  title: {
    type:     String,
    required: true,
    trim:     true
  },
  targetAmount: {
    type:     Number,
    required: true
  },
  savedAmount: {
    type:    Number,
    default: 0
  },
  deadline: {
    type: Date
  },
  emoji: {
    type:    String,
    default: '🎯'
  }
}, { timestamps: true });

module.exports = mongoose.model('Goal', GoalSchema);
