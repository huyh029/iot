const mongoose = require('mongoose');

const sensorDataSchema = new mongoose.Schema({
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: true
  },
  sensorType: {
    type: String,
    enum: ['temperature', 'humidity', 'light', 'wind', 'soil_moisture', 'ph', 'air_quality'],
    required: true
  },
  value: {
    type: Number,
    required: true
  },
  unit: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  location: {
    latitude: Number,
    longitude: Number
  },
  metadata: {
    calibrated: {
      type: Boolean,
      default: true
    },
    accuracy: Number,
    batteryLevel: Number
  }
}, {
  timestamps: true
});

// Index for efficient time-series queries
sensorDataSchema.index({ deviceId: 1, timestamp: -1 });
sensorDataSchema.index({ sensorType: 1, timestamp: -1 });
sensorDataSchema.index({ timestamp: -1 });

// TTL index to automatically delete old data (keep 1 year)
sensorDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 31536000 });

module.exports = mongoose.model('SensorData', sensorDataSchema);