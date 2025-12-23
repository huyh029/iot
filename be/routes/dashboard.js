const express = require('express');
const { auth, checkDeviceAccess } = require('../middleware/auth');
const Device = require('../models/Device');
const SensorData = require('../models/SensorData');
const Plant = require('../models/Plant');
const Control = require('../models/Control');
const axios = require('axios');

const router = express.Router();

// Get dashboard data for a specific device
router.get('/device/:deviceId', auth, checkDeviceAccess, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const wsService = req.app.get('wsService');

    // Get device info
    const device = await Device.findById(deviceId).populate('assignedUsers', 'username fullName');
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Get latest sensor data (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sensorData = await SensorData.find({
      deviceId,
      timestamp: { $gte: last24Hours }
    }).sort({ timestamp: -1 });

    // Get current sensor readings (latest for each sensor type)
    const currentReadings = {};
    const sensorTypes = ['temperature', 'humidity', 'light', 'wind', 'soil_moisture'];
    
    for (const type of sensorTypes) {
      const latest = await SensorData.findOne({
        deviceId,
        sensorType: type
      }).sort({ timestamp: -1 });
      
      if (latest) {
        currentReadings[type] = {
          value: latest.value,
          unit: latest.unit,
          timestamp: latest.timestamp
        };
      }
    }

    // Get weather forecast
    let weatherData = null;
    try {
      const weatherResponse = await axios.get(
        `${process.env.WEATHER_API_URL}/forecast?lat=${device.location.latitude}&lon=${device.location.longitude}&appid=${process.env.WEATHER_API_KEY}&units=metric`
      );
      weatherData = weatherResponse.data;
    } catch (error) {
      console.error('Weather API error:', error.message);
    }

    // Get plants for this device
    const plants = await Plant.find({ deviceId, isActive: true });
    
    // Calculate growth progress for each plant
    const plantsWithProgress = plants.map(plant => {
      const progress = plant.calculateGrowthProgress();
      return {
        ...plant.toObject(),
        growthProgress: progress
      };
    });

    // Get plants nearing harvest (>80% progress)
    const nearHarvestPlants = plantsWithProgress.filter(plant => plant.growthProgress >= 80);

    // Get active controls
    const activeControls = await Control.find({
      deviceId,
      status: 'active',
      isActive: true
    });

    const dashboardData = {
      device: {
        id: device._id,
        name: device.name,
        location: device.location,
        status: device.status,
        lastSeen: device.lastSeen
      },
      currentReadings,
      sensorHistory: sensorData,
      weather: weatherData,
      plants: plantsWithProgress,
      nearHarvestPlants,
      activeControls,
      statistics: {
        totalPlants: plants.length,
        plantsNearHarvest: nearHarvestPlants.length,
        activeControlsCount: activeControls.length,
        deviceUptime: device.status === 'online' ? 
          Math.floor((Date.now() - device.lastSeen) / (1000 * 60)) : null
      }
    };

    // Send real-time dashboard update via WebSocket
    wsService.broadcastDashboardUpdate(req.user.userId, dashboardData);

    res.json(dashboardData);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get overview dashboard for user (all their devices)
router.get('/overview', auth, async (req, res) => {
  try {
    const user = req.userDoc;
    const wsService = req.app.get('wsService');

    let devices = [];

    // Get devices based on user role
    if (user.role === 'superadmin') {
      devices = await Device.find({ isActive: true });
    } else if (user.role === 'manager') {
      devices = await Device.find({ ownerId: user._id, isActive: true });
    } else {
      // User thấy devices của Manager (createdBy)
      if (user.createdBy) {
        devices = await Device.find({ ownerId: user.createdBy, isActive: true });
      } else {
        devices = await Device.find({ 
          _id: { $in: user.deviceIds },
          isActive: true 
        });
      }
    }

    const overviewData = {
      totalDevices: devices.length,
      onlineDevices: devices.filter(d => d.status === 'online').length,
      offlineDevices: devices.filter(d => d.status === 'offline').length,
      devices: devices.map(device => ({
        id: device._id,
        name: device.name,
        location: device.location,
        status: device.status,
        lastSeen: device.lastSeen
      }))
    };

    // Get total plants across all devices
    const totalPlants = await Plant.countDocuments({
      deviceId: { $in: devices.map(d => d._id) },
      isActive: true
    });

    // Get plants nearing harvest
    const nearHarvestPlants = await Plant.find({
      deviceId: { $in: devices.map(d => d._id) },
      isActive: true
    });

    const plantsNearHarvest = nearHarvestPlants.filter(plant => {
      plant.calculateGrowthProgress();
      return plant.growthProgress >= 80;
    });

    overviewData.totalPlants = totalPlants;
    overviewData.plantsNearHarvest = plantsNearHarvest.length;

    // Send real-time overview update
    wsService.broadcastDashboardUpdate(req.user.userId, overviewData);

    res.json(overviewData);
  } catch (error) {
    console.error('Overview dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get real-time sensor data stream
router.get('/sensor-stream/:deviceId', auth, checkDeviceAccess, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { sensorType, limit = 50 } = req.query;

    const query = { deviceId };
    if (sensorType) {
      query.sensorType = sensorType;
    }

    const sensorData = await SensorData.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json(sensorData);
  } catch (error) {
    console.error('Sensor stream error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get device location for map display
router.get('/map-data', auth, async (req, res) => {
  try {
    const user = req.userDoc;

    let devices = [];

    // Get devices based on user role
    if (user.role === 'superadmin') {
      devices = await Device.find({ isActive: true }).select('deviceId name location status');
    } else if (user.role === 'manager') {
      devices = await Device.find({ ownerId: user._id, isActive: true }).select('deviceId name location status');
    } else {
      // User thấy devices của Manager (createdBy)
      if (user.createdBy) {
        devices = await Device.find({ ownerId: user.createdBy, isActive: true }).select('deviceId name location status');
      } else {
        devices = await Device.find({ 
          _id: { $in: user.deviceIds },
          isActive: true 
        }).select('deviceId name location status');
      }
    }

    const mapData = devices.map(device => ({
      id: device._id,
      deviceId: device.deviceId,
      name: device.name,
      latitude: device.location.latitude,
      longitude: device.location.longitude,
      address: device.location.address,
      status: device.status
    }));

    res.json(mapData);
  } catch (error) {
    console.error('Map data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;