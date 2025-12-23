const express = require('express');
const { auth, checkDeviceAccess } = require('../middleware/auth');
const SensorData = require('../models/SensorData');
const Device = require('../models/Device');
const PlantService = require('../services/plantService');

const router = express.Router();

// Receive sensor data from ESP32
router.post('/data', async (req, res) => {
  try {
    const { deviceId, sensorType, value, unit, metadata } = req.body;
    const wsService = req.app.get('wsService');

    // Find device by deviceId string
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Create sensor data record
    const sensorData = new SensorData({
      deviceId: device._id,
      sensorType,
      value,
      unit,
      location: {
        latitude: device.location.latitude,
        longitude: device.location.longitude
      },
      metadata
    });

    await sensorData.save();

    // Update device last seen
    device.lastSeen = new Date();
    device.status = 'online';
    await device.save();

    // Send real-time sensor data to connected clients
    wsService.broadcastSensorData(device._id, sensorData);

    // Update plant conditions if applicable
    if (['temperature', 'humidity', 'light', 'soil_moisture'].includes(sensorType)) {
      const Plant = require('../models/Plant');
      const plants = await Plant.find({ deviceId: device._id, isActive: true });
      
      for (const plant of plants) {
        await PlantService.updatePlantConditions(plant._id, {
          [sensorType]: value
        }, wsService);
      }
    }

    res.status(201).json({ message: 'Sensor data received successfully' });
  } catch (error) {
    console.error('Sensor data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get sensor data for a device
router.get('/device/:deviceId', auth, checkDeviceAccess, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { 
      sensorType, 
      startDate, 
      endDate, 
      limit = 100, 
      page = 1,
      interval = 'hour' // hour, day, week
    } = req.query;

    let query = { deviceId };

    if (sensorType) {
      query.sensorType = sensorType;
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // For aggregated data
    if (interval && interval !== 'raw') {
      let groupBy;
      switch (interval) {
        case 'hour':
          groupBy = {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' },
            hour: { $hour: '$timestamp' }
          };
          break;
        case 'day':
          groupBy = {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          };
          break;
        case 'week':
          groupBy = {
            year: { $year: '$timestamp' },
            week: { $week: '$timestamp' }
          };
          break;
      }

      const aggregatedData = await SensorData.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              ...groupBy,
              sensorType: '$sensorType'
            },
            avgValue: { $avg: '$value' },
            minValue: { $min: '$value' },
            maxValue: { $max: '$value' },
            count: { $sum: 1 },
            timestamp: { $first: '$timestamp' }
          }
        },
        { $sort: { timestamp: -1 } },
        { $limit: parseInt(limit) }
      ]);

      return res.json(aggregatedData);
    }

    // Raw data
    const sensorData = await SensorData.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip((page - 1) * limit);

    const total = await SensorData.countDocuments(query);

    res.json({
      data: sensorData,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get sensor data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get latest sensor readings for a device
router.get('/device/:deviceId/latest', auth, checkDeviceAccess, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const sensorTypes = ['temperature', 'humidity', 'light', 'wind', 'soil_moisture', 'ph', 'air_quality'];
    const latestReadings = {};

    for (const type of sensorTypes) {
      const latest = await SensorData.findOne({
        deviceId,
        sensorType: type
      }).sort({ timestamp: -1 });

      if (latest) {
        latestReadings[type] = {
          value: latest.value,
          unit: latest.unit,
          timestamp: latest.timestamp,
          metadata: latest.metadata
        };
      }
    }

    res.json(latestReadings);
  } catch (error) {
    console.error('Get latest sensor data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get sensor data statistics
router.get('/device/:deviceId/stats', auth, checkDeviceAccess, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { sensorType, period = '24h' } = req.query;

    let startDate;
    switch (period) {
      case '1h':
        startDate = new Date(Date.now() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    let query = {
      deviceId,
      timestamp: { $gte: startDate }
    };

    if (sensorType) {
      query.sensorType = sensorType;
    }

    const stats = await SensorData.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$sensorType',
          avgValue: { $avg: '$value' },
          minValue: { $min: '$value' },
          maxValue: { $max: '$value' },
          count: { $sum: 1 },
          latestValue: { $last: '$value' },
          latestTimestamp: { $last: '$timestamp' }
        }
      }
    ]);

    res.json(stats);
  } catch (error) {
    console.error('Get sensor stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get sensor data for chart/graph
router.get('/device/:deviceId/chart', auth, checkDeviceAccess, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { 
      sensorTypes = 'temperature,humidity', 
      hours = 24 
    } = req.query;

    const sensorTypeArray = sensorTypes.split(',');
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const chartData = await SensorData.aggregate([
      {
        $match: {
          deviceId: deviceId,
          sensorType: { $in: sensorTypeArray },
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            time: {
              $dateToString: {
                format: '%Y-%m-%d %H:00',
                date: '$timestamp'
              }
            },
            sensorType: '$sensorType'
          },
          avgValue: { $avg: '$value' },
          timestamp: { $first: '$timestamp' }
        }
      },
      {
        $sort: { timestamp: 1 }
      },
      {
        $group: {
          _id: '$_id.time',
          timestamp: { $first: '$timestamp' },
          data: {
            $push: {
              sensorType: '$_id.sensorType',
              value: '$avgValue'
            }
          }
        }
      },
      {
        $sort: { timestamp: 1 }
      }
    ]);

    // Transform data for frontend charts
    const transformedData = chartData.map(item => {
      const dataPoint = { timestamp: item.timestamp };
      item.data.forEach(sensor => {
        dataPoint[sensor.sensorType] = Math.round(sensor.value * 100) / 100;
      });
      return dataPoint;
    });

    res.json(transformedData);
  } catch (error) {
    console.error('Get chart data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete old sensor data (cleanup)
router.delete('/cleanup', auth, async (req, res) => {
  try {
    const { days = 365 } = req.query; // Default keep 1 year
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await SensorData.deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    res.json({
      message: `Deleted ${result.deletedCount} old sensor records`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Cleanup sensor data error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;