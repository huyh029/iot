const mongoose = require('mongoose');

const controlSchema = new mongoose.Schema({
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
  controlType: {
    type: String,
    enum: ['light', 'irrigation', 'fan', 'heater', 'cooler', 'fertilizer', 'reminder', 'alert', 'water', 'mist', 'pump'],
    required: true
  },
  mode: {
    type: String,
    enum: ['manual', 'scheduled', 'auto', 'threshold'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'paused', 'error'],
    default: 'inactive'
  },
  // Manual control
  manualSettings: {
    isOn: { type: Boolean, default: false },
    intensity: { type: Number, min: 0, max: 100, default: 0 },
    duration: { type: Number, default: 0 }, // minutes
    startTime: Date,
    endTime: Date
  },
  // Scheduled control
  scheduleSettings: {
    enabled: { type: Boolean, default: true },
    schedules: [{
      name: String,
      time: String, // HH:MM format
      days: [{ type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }],
      action: String, // on, off, notify
      intensity: { type: Number, min: 0, max: 100, default: 100 },
      duration: { type: Number, default: 0 }, // minutes
      isActive: { type: Boolean, default: true }
    }]
  },
  // Auto control (maintain target values)
  autoSettings: {
    targetValue: Number,
    tolerance: { type: Number, default: 5 },
    sensorType: String, // temperature, humidity, light, etc.
    adjustmentRate: { type: Number, default: 10 }, // percentage per adjustment
    minIntensity: { type: Number, default: 0 },
    maxIntensity: { type: Number, default: 100 }
  },
  // Threshold control (trigger when conditions met)
  thresholdSettings: {
    conditions: [{
      sensorType: String,
      operator: { type: String, enum: ['>', '<', '>=', '<=', '=='] },
      value: Number,
      action: {
        intensity: Number,
        duration: Number // minutes, 0 = indefinite
      }
    }],
    notifications: {
      enabled: { type: Boolean, default: true },
      methods: [{ type: String, enum: ['websocket', 'email', 'sms'] }]
    }
  },
  // Alert settings (sensor-based notifications)
  alertSettings: {
    enabled: { type: Boolean, default: true },
    sensor: String, // temperature, humidity, light, soil_moisture
    conditionType: { type: String, enum: ['above', 'below', 'range'] },
    minValue: Number,
    maxValue: Number,
    message: String
  },
  // Current state
  currentState: {
    isOn: { type: Boolean, default: false },
    intensity: { type: Number, default: 0 },
    lastActivated: Date,
    lastDeactivated: Date,
    totalRuntime: { type: Number, default: 0 }, // minutes
    energyConsumption: { type: Number, default: 0 } // kWh
  },
  // History and logs
  executionHistory: [{
    timestamp: { type: Date, default: Date.now },
    action: String,
    mode: String,
    intensity: Number,
    duration: Number,
    triggeredBy: String, // manual, schedule, auto, threshold
    result: String
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
controlSchema.index({ deviceId: 1, controlType: 1 });
controlSchema.index({ userId: 1 });
controlSchema.index({ status: 1 });
controlSchema.index({ mode: 1 });

module.exports = mongoose.model('Control', controlSchema);