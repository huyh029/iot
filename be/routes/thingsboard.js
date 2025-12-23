const express = require('express');
const { auth } = require('../middleware/auth');
const thingsBoardService = require('../services/thingsboard');
const Device = require('../models/Device');
const SensorData = require('../models/SensorData');

const router = express.Router();

// Debug: Check cache status
router.get('/debug/cache', async (req, res) => {
  try {
    const cache = thingsBoardService.deviceTelemetryCache;
    const cacheData = {};
    cache.forEach((value, key) => {
      cacheData[key.substring(0, 8) + '...'] = value;
    });
    res.json({
      cacheSize: cache.size,
      cacheKeys: Array.from(cache.keys()).map(k => k.substring(0, 8) + '...'),
      cacheData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get latest telemetry from ThingsBoard
router.get('/telemetry', auth, async (req, res) => {
  try {
    const telemetry = await thingsBoardService.getLatestTelemetry();
    
    if (!telemetry) {
      return res.status(503).json({ 
        message: 'ThingsBoard service unavailable',
        data: null 
      });
    }

    res.json({
      success: true,
      data: telemetry,
      device: 'TB_Cloud_Device_01'
    });
  } catch (error) {
    console.error('ThingsBoard telemetry error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get formatted sensor data for dashboard
router.get('/sensors', auth, async (req, res) => {
  try {
    const telemetry = await thingsBoardService.getLatestTelemetry();
    
    if (!telemetry) {
      return res.json({
        temperature: { value: null, unit: '°C' },
        humidity: { value: null, unit: '%' },
        light: { value: null, unit: 'lux' },
        soil_moisture: { value: null, unit: '%' },
        wind: { value: null, unit: 'km/h' },
        source: 'thingsboard',
        available: false
      });
    }

    res.json({
      temperature: { 
        value: telemetry.temperature, 
        unit: '°C',
        timestamp: telemetry.timestamp 
      },
      humidity: { 
        value: telemetry.humidity, 
        unit: '%',
        timestamp: telemetry.timestamp 
      },
      light: { 
        value: telemetry.light, 
        unit: 'lux',
        timestamp: telemetry.timestamp 
      },
      soil_moisture: { 
        value: telemetry.soil_moisture, 
        unit: '%',
        timestamp: telemetry.timestamp 
      },
      wind: { 
        value: telemetry.wind, 
        unit: 'km/h',
        timestamp: telemetry.timestamp 
      },
      source: telemetry.source || 'thingsboard',
      cached: telemetry.cached || false,
      available: true
    });
  } catch (error) {
    console.error('ThingsBoard sensors error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Receive telemetry from device (webhook endpoint)
// accessToken can be passed in header or body to identify device
router.post('/webhook', async (req, res) => {
  try {
    const { temperature, humidity, light, soil_moisture, wind, accessToken } = req.body;
    const deviceToken = accessToken || req.headers['x-access-token'];
    
    console.log('📥 Webhook received telemetry:', { temperature, humidity, light, soil_moisture, wind, accessToken: deviceToken?.substring(0, 8) + '...' });
    
    if (!deviceToken) {
      return res.status(400).json({ success: false, message: 'Missing accessToken' });
    }
    
    // Update cache for this device
    const data = {};
    if (temperature !== undefined) data.temperature = temperature;
    if (humidity !== undefined) data.humidity = humidity;
    if (light !== undefined) data.light = light;
    if (soil_moisture !== undefined) data.soil_moisture = soil_moisture;
    if (wind !== undefined) data.wind = wind;

    // Update cache in thingsboard service
    thingsBoardService.updateDeviceTelemetry(deviceToken, data);
    console.log('📥 Cache updated for token:', deviceToken.substring(0, 8) + '...');
    
    // Also forward to ThingsBoard
    const tbResult = await thingsBoardService.sendDeviceTelemetry(deviceToken, data);
    console.log('📥 Forwarded to ThingsBoard:', tbResult);
    
    // Broadcast via WebSocket if available
    const wsService = req.app.get('wsService');
    if (wsService) {
      // Find device by accessToken to get deviceId
      const device = await Device.findOne({ 'thingsboard.accessToken': deviceToken });
      if (device) {
        wsService.broadcastSensorData(device._id, data);
        console.log('📥 Broadcasted to WebSocket for device:', device.name);
      }
    }
    
    res.json({ success: true, message: 'Telemetry received and cached' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send telemetry to ThingsBoard (for testing)
router.post('/telemetry', auth, async (req, res) => {
  try {
    const { temperature, humidity, light, soil_moisture, wind } = req.body;
    
    const data = {};
    if (temperature !== undefined) data.temperature = temperature;
    if (humidity !== undefined) data.humidity = humidity;
    if (light !== undefined) data.light = light;
    if (soil_moisture !== undefined) data.soil_moisture = soil_moisture;
    if (wind !== undefined) data.wind = wind;

    // Update local cache
    thingsBoardService.updateLocalTelemetry(data);

    const success = await thingsBoardService.sendTelemetry(data);
    
    if (success) {
      res.json({ success: true, message: 'Telemetry sent to ThingsBoard' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send telemetry' });
    }
  } catch (error) {
    console.error('ThingsBoard send error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get sensor data for a specific device by its MongoDB ID
router.get('/device/:deviceId/sensors', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const currentUser = req.userDoc;

    // Find device in DB
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Check access permission
    if (currentUser.role === 'manager' && device.ownerId.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    } else if (currentUser.role === 'user') {
      const hasAccess = currentUser.deviceIds?.some(id => id.toString() === deviceId) ||
                        (currentUser.createdBy && device.ownerId.toString() === currentUser.createdBy.toString());
      if (!hasAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Check if device has ThingsBoard integration
    if (!device.thingsboard?.accessToken) {
      return res.json({
        deviceId: device._id,
        deviceName: device.name,
        temperature: { value: null, unit: '°C' },
        humidity: { value: null, unit: '%' },
        light: { value: null, unit: 'lux' },
        soil_moisture: { value: null, unit: '%' },
        wind: { value: null, unit: 'km/h' },
        available: false,
        message: 'Device not connected to ThingsBoard'
      });
    }

    // Get telemetry from ThingsBoard using device's access token and device ID
    console.log(`📡 Fetching telemetry for device ${device.name}`);
    console.log(`📡 Access Token: ${device.thingsboard.accessToken}`);
    console.log(`📡 ThingsBoard Device ID: ${device.thingsboard.deviceId}`);
    const telemetry = await thingsBoardService.getDeviceTelemetry(
      device.thingsboard.accessToken,
      device.thingsboard.deviceId // Pass ThingsBoard device ID if available
    );
    console.log('📊 Telemetry result:', telemetry);

    if (!telemetry) {
      return res.json({
        deviceId: device._id,
        deviceName: device.name,
        accessToken: device.thingsboard.accessToken,
        temperature: { value: null, unit: '°C' },
        humidity: { value: null, unit: '%' },
        light: { value: null, unit: 'lux' },
        soil_moisture: { value: null, unit: '%' },
        wind: { value: null, unit: 'km/h' },
        available: false,
        message: 'Could not fetch telemetry from ThingsBoard'
      });
    }

    res.json({
      deviceId: device._id,
      deviceName: device.name,
      accessToken: device.thingsboard.accessToken,
      temperature: { value: telemetry.temperature, unit: '°C' },
      humidity: { value: telemetry.humidity, unit: '%' },
      light: { value: telemetry.light, unit: 'lux' },
      soil_moisture: { value: telemetry.soil_moisture, unit: '%' },
      wind: { value: telemetry.wind, unit: 'km/h' },
      timestamp: telemetry.timestamp,
      source: telemetry.source,
      available: true
    });
  } catch (error) {
    console.error('Get device sensors error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get control states for a device from ThingsBoard attributes
router.get('/device/:deviceId/controls', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const currentUser = req.userDoc;

    // Find device in DB
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Check access permission
    if (currentUser.role === 'manager' && device.ownerId.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!device.thingsboard?.accessToken) {
      return res.json({
        deviceId: device._id,
        controls: {},
        available: false,
        message: 'Device not connected to ThingsBoard'
      });
    }

    // Get control states from ThingsBoard attributes
    const controlStates = await thingsBoardService.getDeviceControlStates(device.thingsboard.accessToken);

    res.json({
      deviceId: device._id,
      deviceName: device.name,
      controls: controlStates || {},
      available: true
    });
  } catch (error) {
    console.error('Get device controls error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
