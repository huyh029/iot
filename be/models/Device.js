const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['esp32', 'sensor', 'actuator', 'camera'],
    default: 'esp32'
  },
  location: {
    address: {
      type: String,
      default: ''
    }
  },
  status: {
    type: String,
    enum: ['online', 'offline', 'maintenance'],
    default: 'offline'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // ThingsBoard integration
  thingsboard: {
    deviceId: String,        // ThingsBoard device ID
    accessToken: String,     // Device access token for MQTT/HTTP
    provisionKey: String,    // Provision device key
    provisionSecret: String, // Provision device secret
    createdAt: Date          // When device was created on ThingsBoard
  },
  specifications: {
    model: String,
    version: String,
    capabilities: [String]
  },
  configuration: {
    mqttTopic: String,
    updateInterval: {
      type: Number,
      default: 30 // seconds
    },
    timezone: {
      type: String,
      default: 'Asia/Ho_Chi_Minh'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
deviceSchema.index({ deviceId: 1 });
deviceSchema.index({ ownerId: 1 });
deviceSchema.index({ status: 1 });
deviceSchema.index({ 'thingsboard.deviceId': 1 });

module.exports = mongoose.model('Device', deviceSchema);