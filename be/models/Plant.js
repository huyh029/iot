const mongoose = require('mongoose');

const plantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['vegetable', 'fruit', 'herb', 'flower']
  },
  variety: {
    type: String,
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
  plantedDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  expectedHarvestDate: {
    type: Date,
    required: true
  },
  growthStage: {
    type: String,
    enum: ['seed', 'germination', 'seedling', 'vegetative', 'flowering', 'fruiting', 'harvest'],
    default: 'seed'
  },
  growthProgress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  location: {
    zone: String,
    row: Number,
    column: Number
  },
  optimalConditions: {
    temperature: {
      min: Number,
      max: Number,
      unit: { type: String, default: '°C' }
    },
    humidity: {
      min: Number,
      max: Number,
      unit: { type: String, default: '%' }
    },
    light: {
      min: Number,
      max: Number,
      unit: { type: String, default: 'lux' }
    },
    soilMoisture: {
      min: Number,
      max: Number,
      unit: { type: String, default: '%' }
    }
  },
  currentConditions: {
    temperature: Number,
    humidity: Number,
    light: Number,
    soilMoisture: Number,
    lastUpdated: { type: Date, default: Date.now }
  },
  notes: [{
    date: { type: Date, default: Date.now },
    content: String,
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  images: [{
    url: String,
    caption: String,
    date: { type: Date, default: Date.now }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Calculate growth progress based on planted date and expected harvest
plantSchema.methods.calculateGrowthProgress = function() {
  const now = new Date();
  const totalDays = Math.ceil((this.expectedHarvestDate - this.plantedDate) / (1000 * 60 * 60 * 24));
  const daysPassed = Math.ceil((now - this.plantedDate) / (1000 * 60 * 60 * 24));
  
  this.growthProgress = Math.min(Math.max((daysPassed / totalDays) * 100, 0), 100);
  return this.growthProgress;
};

// Index for efficient queries
plantSchema.index({ deviceId: 1 });
plantSchema.index({ userId: 1 });
plantSchema.index({ growthStage: 1 });

module.exports = mongoose.model('Plant', plantSchema);