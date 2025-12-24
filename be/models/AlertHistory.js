const mongoose = require('mongoose');

const alertHistorySchema = new mongoose.Schema({
  reminderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Reminder',
    required: true
  },
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sensorType: {
    type: String,
    required: true
  },
  condition: {
    type: String,
    required: true
  },
  thresholdValue: {
    type: Number,
    required: true
  },
  actualValue: {
    type: Number,
    required: true
  },
  emailSent: {
    type: Boolean,
    default: false
  },
  emailError: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
alertHistorySchema.index({ deviceId: 1, timestamp: -1 });
alertHistorySchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('AlertHistory', alertHistorySchema);
