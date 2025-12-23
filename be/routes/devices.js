const express = require('express');
const { auth, authorize, checkDeviceAccess } = require('../middleware/auth');
const Device = require('../models/Device');
const User = require('../models/User');
const SensorData = require('../models/SensorData');
const Control = require('../models/Control');
const thingsBoardService = require('../services/thingsboard');
const emailService = require('../services/emailService');

const router = express.Router();

// Alert cooldown tracking (prevent spam emails)
const alertCooldowns = new Map(); // key: `${deviceId}_${sensorType}` -> lastAlertTime
const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes between alerts for same sensor

// TEST: Send test email alert
router.get('/test-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    console.log(`📧 Testing email to: ${email}`);
    
    const result = await emailService.sendThresholdAlert(email, {
      deviceName: 'Test Device',
      sensorType: 'temperature',
      value: 35,
      threshold: 30,
      condition: 'above'
    });
    
    res.json({
      success: result,
      message: result ? 'Email sent successfully' : 'Email failed - check server logs',
      to: email
    });
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all devices with status (public - for debugging)
router.get('/status/all', async (req, res) => {
  try {
    const devices = await Device.find({}, 'deviceId name status lastSeen thingsboard.accessToken')
      .sort({ lastSeen: -1 });
    
    res.json({
      success: true,
      count: devices.length,
      devices: devices.map(d => ({
        deviceId: d.deviceId,
        name: d.name,
        status: d.status,
        lastSeen: d.lastSeen,
        hasThingsBoard: !!d.thingsboard?.accessToken
      }))
    });
  } catch (error) {
    console.error('Get all devices status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get ThingsBoard access token by device ID (for ESP32)
// No auth required - ESP32 uses this to get its access token
router.get('/token/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    // Find device by deviceId field (e.g., "100100C40A24")
    const device = await Device.findOne({ deviceId: deviceId });
    
    if (!device) {
      return res.status(404).json({ 
        success: false,
        message: 'Device not found' 
      });
    }
    
    if (!device.thingsboard?.accessToken) {
      return res.status(404).json({ 
        success: false,
        message: 'Device not connected to ThingsBoard' 
      });
    }
    
    res.json({
      success: true,
      deviceId: device.deviceId,
      accessToken: device.thingsboard.accessToken,
      thingsboardHost: 'thingsboard.cloud',
      mqttPort: 1883
    });
  } catch (error) {
    console.error('Get device token error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get control states by device ID (for ESP32)
// Also acts as heartbeat + reads telemetry from ThingsBoard + checks thresholds from DB
router.get('/controls/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const wsService = req.app.get('wsService');
    
    // Find device by deviceId field (e.g., "100100C40A24")
    const device = await Device.findOne({ deviceId: deviceId }).populate('ownerId', 'email fullName');
    
    if (!device) {
      return res.status(404).json({ 
        success: false,
        message: 'Device not found' 
      });
    }
    
    // === HEARTBEAT: Update status to online ===
    const wasOffline = device.status !== 'online';
    const previousStatus = device.status;
    device.status = 'online';
    device.lastSeen = new Date();
    await device.save();
    
    console.log(`📡 Device ${deviceId}: ${previousStatus} → online (lastSeen: ${device.lastSeen.toISOString()})`);
    
    // Broadcast status change if device was offline
    if (wasOffline && wsService) {
      wsService.broadcastDeviceStatus(device._id.toString(), 'online');
      
      // Notify owner
      wsService.sendNotificationToUser(device.ownerId._id.toString(), {
        type: 'device_online',
        message: `Thiết bị "${device.name}" đã online`,
        severity: 'success',
        deviceId: device._id
      });
    }
    // === END HEARTBEAT ===
    
    // === READ TELEMETRY FROM THINGSBOARD ===
    let sensorData = {
      temperature: null,
      humidity: null,
      light: null,
      soil_moisture: null,
      wind: null
    };
    
    if (device.thingsboard?.accessToken && device.thingsboard?.deviceId) {
      const telemetry = await thingsBoardService.getDeviceTelemetry(
        device.thingsboard.accessToken,
        device.thingsboard.deviceId
      );
      
      if (telemetry) {
        sensorData = {
          temperature: telemetry.temperature ?? null,
          humidity: telemetry.humidity ?? null,
          light: telemetry.light ?? null,
          soil_moisture: telemetry.soil_moisture ?? null,
          wind: telemetry.wind ?? null
        };
      }
    }
    // === END READ TELEMETRY ===
    
    // === CHECK THRESHOLDS FROM DB & SEND ALERTS ===
    const alerts = [];
    const hasSensorData = sensorData.temperature !== null || sensorData.humidity !== null || 
                          sensorData.light !== null || sensorData.soil_moisture !== null;
    
    if (hasSensorData) {
      // Find threshold controls for this device from DB
      const thresholdControls = await Control.find({
        deviceId: device._id,
        mode: 'threshold',
        isActive: true
      });
      
      console.log(`🔍 Found ${thresholdControls.length} threshold controls for device ${device.name}`);
      
      for (const control of thresholdControls) {
        const conditions = control.thresholdSettings?.conditions || [];
        console.log(`🔍 Control ${control.controlType}: ${conditions.length} conditions, notifications: ${JSON.stringify(control.thresholdSettings?.notifications)}`);
        
        for (const condition of conditions) {
          const { sensorType, operator, value: thresholdValue } = condition;
          const currentValue = sensorData[sensorType];
          
          if (currentValue === null || currentValue === undefined) continue;
          
          console.log(`🔍 Checking ${sensorType}: ${currentValue} ${operator} ${thresholdValue}`);
          
          // Check if threshold is exceeded
          let isExceeded = false;
          let alertType = '';
          
          switch (operator) {
            case '>':
              isExceeded = currentValue > thresholdValue;
              alertType = 'above';
              break;
            case '>=':
              isExceeded = currentValue >= thresholdValue;
              alertType = 'above';
              break;
            case '<':
              isExceeded = currentValue < thresholdValue;
              alertType = 'below';
              break;
            case '<=':
              isExceeded = currentValue <= thresholdValue;
              alertType = 'below';
              break;
            case '==':
              isExceeded = currentValue === thresholdValue;
              alertType = 'equal';
              break;
          }
          
          if (isExceeded) {
            const cooldownKey = `${deviceId}_${sensorType}`;
            const lastAlert = alertCooldowns.get(cooldownKey);
            const now = Date.now();
            
            // Check cooldown to prevent spam (5 minutes)
            if (!lastAlert || (now - lastAlert) > ALERT_COOLDOWN) {
              alertCooldowns.set(cooldownKey, now);
              
              const alertInfo = {
                sensorType,
                value: currentValue,
                threshold: thresholdValue,
                operator,
                condition: alertType
              };
              alerts.push(alertInfo);
              
              console.log(`⚠️ Alert: ${device.name} - ${sensorType} ${operator} ${thresholdValue} (current: ${currentValue})`);
              
              // Send WebSocket notification
              if (wsService) {
                wsService.sendNotificationToUser(device.ownerId._id.toString(), {
                  type: 'threshold_alert',
                  message: `⚠️ ${device.name}: ${getSensorName(sensorType)} ${operator} ${thresholdValue} - Hiện tại: ${currentValue}`,
                  severity: 'warning',
                  deviceId: device._id,
                  sensorType,
                  value: currentValue
                });
              }
              
              // Send email alert if enabled
              const notifications = control.thresholdSettings?.notifications;
              if (notifications?.enabled && notifications?.methods?.includes('email')) {
                if (device.ownerId?.email) {
                  emailService.sendThresholdAlert(device.ownerId.email, {
                    deviceName: device.name,
                    sensorType,
                    value: currentValue,
                    threshold: thresholdValue,
                    condition: alertType
                  }).catch(err => console.error('Email alert error:', err));
                  
                  console.log(`📧 Alert email sent to ${device.ownerId.email}`);
                }
              }
              
              // Auto-activate control if action is defined
              if (condition.action?.intensity !== undefined) {
                control.status = 'active';
                control.currentState.isOn = true;
                control.currentState.intensity = condition.action.intensity;
                control.currentState.lastActivated = new Date();
                
                if (condition.action.duration > 0) {
                  control.manualSettings.endTime = new Date(Date.now() + condition.action.duration * 60000);
                }
                
                await control.save();
                
                // Broadcast control update
                if (wsService) {
                  wsService.broadcastControlUpdate(device._id.toString(), control);
                }
              }
            }
          }
        }
      }
    }
    // === END THRESHOLD CHECK ===
    
    // Get control states from ThingsBoard attributes
    let controls = {
      light: { enabled: false, intensity: 100 },
      fan: { enabled: false, intensity: 100 },
      pump: { enabled: false, intensity: 100 },
      watering: { enabled: false, intensity: 100 },
      heater: { enabled: false, intensity: 100 },
      cooler: { enabled: false, intensity: 100 },
      mist: { enabled: false, intensity: 100 }
    };
    
    if (device.thingsboard?.accessToken) {
      const tbControls = await thingsBoardService.getDeviceControlStates(device.thingsboard.accessToken);
      if (tbControls) {
        controls = tbControls;
      }
    }
    
    res.json({
      success: true,
      deviceId: device.deviceId,
      status: device.status,
      telemetry: sensorData,
      alerts: alerts,
      controls: controls
    });
  } catch (error) {
    console.error('Get device controls error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Helper function to get sensor name in Vietnamese
function getSensorName(type) {
  const names = {
    temperature: 'Nhiệt độ',
    humidity: 'Độ ẩm',
    light: 'Ánh sáng',
    soil_moisture: 'Độ ẩm đất',
    wind: 'Gió'
  };
  return names[type] || type;
}

// Get all devices
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const currentUser = req.userDoc;

    let query = {};

    // Filter based on user role
    if (currentUser.role === 'manager') {
      query.ownerId = currentUser._id;
    } else if (currentUser.role === 'user') {
      // User thấy devices của mình VÀ của Manager (createdBy)
      if (currentUser.createdBy) {
        query.ownerId = currentUser.createdBy;
      } else {
        query._id = { $in: currentUser.deviceIds };
      }
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { deviceId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { 'location.address': { $regex: search, $options: 'i' } }
      ];
    }

    const devices = await Device.find(query)
      .populate('ownerId', 'username fullName')
      .populate('assignedUsers', 'username fullName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Device.countDocuments(query);

    res.json({
      devices,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single device
router.get('/:deviceId', auth, checkDeviceAccess, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const device = await Device.findById(deviceId)
      .populate('ownerId', 'username fullName email')
      .populate('assignedUsers', 'username fullName email');

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Get latest sensor data
    const latestSensorData = await SensorData.find({ deviceId })
      .sort({ timestamp: -1 })
      .limit(10);

    res.json({
      device,
      latestSensorData
    });
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new device (SuperAdmin and Manager only)
router.post('/', auth, authorize('superadmin', 'manager'), async (req, res) => {
  try {
    const {
      deviceId,
      name,
      type,
      location,
      specifications,
      configuration
    } = req.body;
    const wsService = req.app.get('wsService');
    const currentUser = req.userDoc;

    // Check if deviceId already exists
    const existingDevice = await Device.findOne({ deviceId });
    if (existingDevice) {
      return res.status(400).json({ message: 'Device ID already exists' });
    }

    // Provision device on ThingsBoard
    const tbDeviceName = `${deviceId}_${name.replace(/\s+/g, '_')}`;
    const provisionResult = await thingsBoardService.provisionDevice(tbDeviceName);
    
    if (!provisionResult.success) {
      console.error('❌ ThingsBoard provision failed:', provisionResult.error);
      return res.status(500).json({ 
        message: 'Không thể tạo thiết bị trên ThingsBoard', 
        error: provisionResult.error 
      });
    }

    const thingsboardData = {
      deviceId: provisionResult.deviceId,
      accessToken: provisionResult.accessToken,
      provisionKey: provisionResult.provisionKey,
      provisionSecret: provisionResult.provisionSecret,
      createdAt: new Date()
    };
    console.log('✅ ThingsBoard device provisioned:', tbDeviceName);

    // Create device
    const device = new Device({
      deviceId,
      name,
      type,
      location,
      specifications,
      configuration,
      thingsboard: thingsboardData,
      ownerId: currentUser.role === 'superadmin' ? req.body.ownerId || currentUser._id : currentUser._id
    });

    await device.save();
    await device.populate('ownerId', 'username fullName');

    // Send real-time update
    wsService.broadcastDeviceUpdate(device.ownerId._id, device);

    // Send notification
    wsService.sendNotificationToUser(device.ownerId._id, {
      type: 'device_created',
      message: `New device "${device.name}" has been added`,
      severity: 'success',
      deviceId: device._id
    });

    res.status(201).json(device);
  } catch (error) {
    console.error('Create device error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update device
router.put('/:deviceId', auth, checkDeviceAccess, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const updates = req.body;
    const wsService = req.app.get('wsService');

    const device = await Device.findByIdAndUpdate(
      deviceId,
      updates,
      { new: true, runValidators: true }
    ).populate('ownerId', 'username fullName')
     .populate('assignedUsers', 'username fullName');

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Send real-time update
    wsService.broadcastDeviceUpdate(device.ownerId._id, device);

    // Send notification to assigned users
    for (const user of device.assignedUsers) {
      wsService.sendNotificationToUser(user._id, {
        type: 'device_updated',
        message: `Device "${device.name}" has been updated`,
        severity: 'info',
        deviceId: device._id
      });
    }

    res.json(device);
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update device status (for ESP32 heartbeat)
router.put('/:deviceId/status', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { status } = req.body;
    const wsService = req.app.get('wsService');

    const device = await Device.findByIdAndUpdate(
      deviceId,
      { 
        status,
        lastSeen: new Date()
      },
      { new: true }
    ).populate('assignedUsers', 'username fullName');

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Send real-time status update
    wsService.broadcastDeviceStatus(deviceId, status);

    // Send notification for status changes
    if (status === 'offline') {
      for (const user of device.assignedUsers) {
        wsService.sendNotificationToUser(user._id, {
          type: 'device_offline',
          message: `Device "${device.name}" has gone offline`,
          severity: 'warning',
          deviceId: device._id
        });
      }
    } else if (status === 'online') {
      for (const user of device.assignedUsers) {
        wsService.sendNotificationToUser(user._id, {
          type: 'device_online',
          message: `Device "${device.name}" is back online`,
          severity: 'success',
          deviceId: device._id
        });
      }
    }

    res.json(device);
  } catch (error) {
    console.error('Update device status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign users to device
router.post('/:deviceId/assign-users', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { userIds } = req.body;
    const wsService = req.app.get('wsService');
    const currentUser = req.userDoc;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Check permissions
    if (currentUser.role === 'manager' && device.ownerId.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    } else if (currentUser.role === 'user') {
      return res.status(403).json({ message: 'Users cannot assign devices' });
    }

    // Verify users exist and belong to the manager (if manager is assigning)
    if (currentUser.role === 'manager') {
      const users = await User.find({
        _id: { $in: userIds },
        managerId: currentUser._id
      });

      if (users.length !== userIds.length) {
        return res.status(400).json({ message: 'Some users do not belong to you' });
      }
    }

    // Update device assigned users
    device.assignedUsers = userIds;
    await device.save();

    // Update users' device assignments
    await User.updateMany(
      { _id: { $in: userIds } },
      { $addToSet: { deviceIds: deviceId } }
    );

    // Remove device from users not in the new list
    await User.updateMany(
      { 
        _id: { $nin: userIds },
        deviceIds: deviceId 
      },
      { $pull: { deviceIds: deviceId } }
    );

    await device.populate('assignedUsers', 'username fullName');

    // Send real-time update
    wsService.broadcastDeviceUpdate(device.ownerId, device);

    // Send notifications to assigned users
    for (const userId of userIds) {
      wsService.sendNotificationToUser(userId, {
        type: 'device_assigned',
        message: `You have been assigned to device "${device.name}"`,
        severity: 'info',
        deviceId: device._id
      });
    }

    res.json(device);
  } catch (error) {
    console.error('Assign users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete device (soft delete)
router.delete('/:deviceId', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const wsService = req.app.get('wsService');
    const currentUser = req.userDoc;

    const device = await Device.findById(deviceId).populate('assignedUsers', 'username fullName');
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Check permissions
    if (currentUser.role === 'manager' && device.ownerId.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    } else if (currentUser.role === 'user') {
      return res.status(403).json({ message: 'Users cannot delete devices' });
    }

    // Delete device from ThingsBoard
    if (device.thingsboard?.deviceId) {
      const tbResult = await thingsBoardService.deleteDevice(device.thingsboard.deviceId);
      if (!tbResult.success) {
        console.error('⚠️ Could not delete device from ThingsBoard:', tbResult.error);
      }
    }

    // Hard delete from MongoDB
    await Device.findByIdAndDelete(deviceId);

    // Remove device from all user assignments
    await User.updateMany(
      { deviceIds: deviceId },
      { $pull: { deviceIds: deviceId } }
    );

    // Send real-time update
    wsService.broadcastDeviceUpdate(device.ownerId, { ...device.toObject(), deleted: true });

    // Send notifications to assigned users
    for (const user of device.assignedUsers) {
      wsService.sendNotificationToUser(user._id, {
        type: 'device_removed',
        message: `Device "${device.name}" has been removed from your account`,
        severity: 'warning'
      });
    }

    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get device statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const currentUser = req.userDoc;

    let query = {};
    if (currentUser.role === 'manager') {
      query.ownerId = currentUser._id;
    } else if (currentUser.role === 'user') {
      // User thấy stats của devices thuộc Manager (createdBy)
      if (currentUser.createdBy) {
        query.ownerId = currentUser.createdBy;
      } else {
        query._id = { $in: currentUser.deviceIds };
      }
    }

    const totalDevices = await Device.countDocuments(query);
    const onlineDevices = await Device.countDocuments({ ...query, status: 'online' });
    const offlineDevices = await Device.countDocuments({ ...query, status: 'offline' });
    const maintenanceDevices = await Device.countDocuments({ ...query, status: 'maintenance' });

    const devicesByType = await Device.aggregate([
      { $match: query },
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    const recentDevices = await Device.find(query)
      .sort({ createdAt: -1 })
      .limit(5)
      .select('deviceId name status createdAt')
      .populate('ownerId', 'username');

    res.json({
      totalDevices,
      onlineDevices,
      offlineDevices,
      maintenanceDevices,
      devicesByType,
      recentDevices
    });
  } catch (error) {
    console.error('Get device stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;