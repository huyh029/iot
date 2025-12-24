const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
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
    enum: ['temperature', 'humidity', 'soil_moisture', 'light'],
    required: true
  },
  condition: {
    type: String,
    enum: ['above', 'below'],
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  enabled: {
    type: Boolean,
    default: true
  },
  emailNotification: {
    type: Boolean,
    default: true
  },
  cooldown: {
    type: Number,
    default: 5 // minutes
  },
  lastTriggered: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
reminderSchema.index({ deviceId: 1, enabled: 1 });
reminderSchema.index({ userId: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);
