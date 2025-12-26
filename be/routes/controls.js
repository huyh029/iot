const express = require('express');
const { auth, checkDeviceAccess } = require('../middleware/auth');
const Control = require('../models/Control');
const Device = require('../models/Device');
const User = require('../models/User');
const emailService = require('../services/emailService');

const router = express.Router();

// Helper function to check if user has access to device
const userHasDeviceAccess = (user, device) => {
  if (user.role === 'user') {
    const hasDirectAccess = user.deviceIds.map(id => id.toString()).includes(device._id.toString());
    const hasManagerAccess = user.createdBy && device.ownerId.toString() === user.createdBy.toString();
    return hasDirectAccess || hasManagerAccess;
  }
  if (user.role === 'manager') {
    return device.ownerId.toString() === user._id.toString();
  }
  return true; // superadmin
};

// Track last alert time to prevent spam (deviceId_sensorType -> timestamp)
const lastAlertTime = new Map();
const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 phút giữa các email cùng loại

// ============================================
// API CHO THIẾT BỊ NHÚNG (ESP32) - CHỈ CẦN 1 API GET
// ============================================

// GET /api/controls/esp/:deviceId
// ESP32 gọi API này để lấy trạng thái điều khiển
// Kết hợp: MQTT states + Automation rules từ DB + Email alerts
router.get('/esp/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { telemetry } = req.query; // Optional: ESP gửi kèm telemetry để check automation
    const mqttService = req.app.get('mqttService');

    // Tìm device theo deviceId (mã thiết bị)
    const device = await Device.findOne({ deviceId: deviceId }).populate('ownerId', 'email fullName');
    if (!device) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }

    // Cập nhật trạng thái online và lastSeen
    device.status = 'online';
    device.lastSeen = new Date();
    await device.save();

    // 1. Lấy trạng thái điều khiển từ MQTT cache
    let controlStates = mqttService.getDeviceControlStates(deviceId);

    // 2. Kiểm tra automation rules từ DB
    const automationChanges = [];
    const emailAlerts = [];
    const controls = await Control.find({ 
      deviceId: device._id, 
      isActive: true 
    }).populate('userId', 'email fullName');

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay(); // 0=CN, 1=T2...
    const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

    // Parse telemetry nếu có
    let sensorData = null;
    if (telemetry) {
      try {
        sensorData = JSON.parse(telemetry);
      } catch (e) {
        console.log('Invalid telemetry JSON');
      }
    }

    for (const control of controls) {
      // 2a. Kiểm tra Schedule (lịch hẹn giờ)
      if (control.scheduleSettings?.enabled && control.scheduleSettings.schedules) {
        for (const schedule of control.scheduleSettings.schedules) {
          const scheduleDays = schedule.days || [0, 1, 2, 3, 4, 5, 6];
          
          // Kiểm tra ngày và giờ
          if (scheduleDays.includes(currentDay) && schedule.time === currentTime) {
            const newState = schedule.action === 'on';
            const currentState = controlStates[control.controlType]?.enabled || false;
            
            if (newState !== currentState) {
              controlStates[control.controlType] = {
                enabled: newState,
                intensity: schedule.intensity || 100
              };
              automationChanges.push({
                type: 'schedule',
                controlType: control.controlType,
                action: schedule.action,
                reason: `Lịch hẹn ${schedule.time}`
              });
            }
          }
        }
      }

      // 2b. Kiểm tra Sensor Triggers (tự động theo cảm biến)
      if (sensorData && control.automaticSettings?.enabled && control.automaticSettings.triggers) {
        for (const trigger of control.automaticSettings.triggers) {
          const sensorValue = sensorData[trigger.sensorType];
          
          if (sensorValue !== undefined) {
            let shouldTrigger = false;
            
            if (trigger.condition === 'above' && sensorValue > trigger.threshold) {
              shouldTrigger = true;
            } else if (trigger.condition === 'below' && sensorValue < trigger.threshold) {
              shouldTrigger = true;
            }

            if (shouldTrigger) {
              const newState = trigger.action === 'on';
              controlStates[control.controlType] = {
                enabled: newState,
                intensity: trigger.intensity || 100
              };
              automationChanges.push({
                type: 'sensor',
                controlType: control.controlType,
                action: trigger.action,
                reason: `${trigger.sensorType} ${trigger.condition} ${trigger.threshold} (hiện tại: ${sensorValue})`
              });

              // Thêm vào danh sách gửi email
              emailAlerts.push({
                userEmail: control.userId?.email,
                deviceName: device.name,
                controlType: control.controlType,
                action: trigger.action,
                sensorType: trigger.sensorType,
                sensorValue,
                threshold: trigger.threshold,
                condition: trigger.condition
              });
            }
          }
        }
      }

      // 2c. Kiểm tra Alert Settings (chỉ gửi email, không điều khiển)
      if (sensorData && control.alertSettings?.enabled) {
        const sensorValue = sensorData[control.alertSettings.sensor];
        
        if (sensorValue !== undefined) {
          let shouldAlert = false;
          let alertCondition = '';
          
          if (control.alertSettings.conditionType === 'above' && sensorValue > control.alertSettings.maxValue) {
            shouldAlert = true;
            alertCondition = 'above';
          } else if (control.alertSettings.conditionType === 'below' && sensorValue < control.alertSettings.minValue) {
            shouldAlert = true;
            alertCondition = 'below';
          } else if (control.alertSettings.conditionType === 'range') {
            if (sensorValue < control.alertSettings.minValue || sensorValue > control.alertSettings.maxValue) {
              shouldAlert = true;
              alertCondition = sensorValue < control.alertSettings.minValue ? 'below' : 'above';
            }
          }

          if (shouldAlert) {
            emailAlerts.push({
              userEmail: control.userId?.email,
              deviceName: device.name,
              controlType: 'alert',
              sensorType: control.alertSettings.sensor,
              sensorValue,
              threshold: alertCondition === 'above' ? control.alertSettings.maxValue : control.alertSettings.minValue,
              condition: alertCondition,
              message: control.alertSettings.message
            });
          }
        }
      }
    }

    // 3. Nếu có thay đổi từ automation, gửi qua MQTT
    if (automationChanges.length > 0) {
      for (const change of automationChanges) {
        mqttService.controlDevice(
          deviceId, 
          change.controlType, 
          change.action, 
          controlStates[change.controlType]?.intensity || 100
        );
      }
      console.log(`🤖 Automation triggered for ${deviceId}:`, automationChanges);
    }

    // 4. Gửi email alerts (với cooldown để tránh spam)
    for (const alert of emailAlerts) {
      if (!alert.userEmail) continue;
      
      const alertKey = `${deviceId}_${alert.sensorType}`;
      const lastTime = lastAlertTime.get(alertKey);
      
      if (!lastTime || (Date.now() - lastTime) > ALERT_COOLDOWN) {
        lastAlertTime.set(alertKey, Date.now());
        
        // Gửi email cảnh báo ngưỡng
        await emailService.sendThresholdAlert(alert.userEmail, {
          deviceName: alert.deviceName,
          sensorType: alert.sensorType,
          value: alert.sensorValue,
          threshold: alert.threshold,
          condition: alert.condition
        });

        // Nếu có điều khiển tự động, gửi thêm email thông báo
        if (alert.controlType !== 'alert') {
          await emailService.sendAutoControlNotification(alert.userEmail, {
            deviceName: alert.deviceName,
            controlType: alert.controlType,
            action: alert.action,
            reason: `${alert.sensorType} ${alert.condition} ${alert.threshold} (hiện tại: ${alert.sensorValue})`
          });
        }

        console.log(`📧 Email alert sent to ${alert.userEmail} for ${alert.sensorType}`);
      }
    }

    // Trả về cho ESP32
    res.json({
      success: true,
      deviceId: device.deviceId,
      controls: controlStates,
      automationTriggered: automationChanges.length > 0 ? automationChanges : undefined,
      alertsSent: emailAlerts.length
    });

  } catch (error) {
    console.error('ESP get controls error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// API CHO FRONTEND (cần auth)
// ============================================

// Get all controls for a device
router.get('/device/:deviceId', auth, checkDeviceAccess, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const controls = await Control.find({ deviceId, isActive: true })
      .populate('userId', 'username fullName')
      .sort({ controlType: 1 });

    res.json(controls);
  } catch (error) {
    console.error('Get controls error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new control
router.post('/', auth, async (req, res) => {
  try {
    const { deviceId, controlType, mode, ...settings } = req.body;
    const wsService = req.app.get('wsService');

    // Check device access
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Check if user has access to this device
    const user = req.userDoc;
    if (user.role === 'user') {
      // User có thể truy cập device của mình HOẶC của Manager (createdBy)
      const hasDirectAccess = user.deviceIds.includes(deviceId);
      const hasManagerAccess = user.createdBy && device.ownerId.toString() === user.createdBy.toString();
      
      if (!hasDirectAccess && !hasManagerAccess) {
        return res.status(403).json({ message: 'Access denied to this device' });
      }
    }

    if (user.role === 'manager' && device.ownerId.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'Access denied to this device' });
    }

    const control = new Control({
      deviceId,
      userId: user._id,
      controlType,
      mode,
      ...settings
    });

    await control.save();
    await control.populate('userId', 'username fullName');

    // Send real-time update
    wsService.broadcastControlUpdate(deviceId, control);

    res.status(201).json(control);
  } catch (error) {
    console.error('Create control error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update control
router.put('/:controlId', auth, async (req, res) => {
  try {
    const { controlId } = req.params;
    const updates = req.body;
    const wsService = req.app.get('wsService');

    const control = await Control.findById(controlId);
    if (!control) {
      return res.status(404).json({ message: 'Control not found' });
    }

    // Check device access
    const device = await Device.findById(control.deviceId);
    const user = req.userDoc;

    if (!userHasDeviceAccess(user, device)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update control
    Object.assign(control, updates);
    control.updatedAt = new Date();
    
    // Add to execution history
    control.executionHistory.push({
      action: 'updated',
      mode: control.mode,
      triggeredBy: 'manual',
      result: 'success'
    });

    await control.save();
    await control.populate('userId', 'username fullName');

    // Send real-time update
    wsService.broadcastControlUpdate(control.deviceId, control);

    res.json(control);
  } catch (error) {
    console.error('Update control error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Manual control activation
router.post('/:controlId/activate', auth, async (req, res) => {
  try {
    const { controlId } = req.params;
    const { intensity, duration } = req.body;
    const wsService = req.app.get('wsService');

    const control = await Control.findById(controlId);
    if (!control) {
      return res.status(404).json({ message: 'Control not found' });
    }

    // Check device access
    const device = await Device.findById(control.deviceId);
    const user = req.userDoc;

    if (!userHasDeviceAccess(user, device)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update manual settings
    control.manualSettings.isOn = true;
    control.manualSettings.intensity = intensity || 50;
    control.manualSettings.duration = duration || 0;
    control.manualSettings.startTime = new Date();
    
    if (duration > 0) {
      control.manualSettings.endTime = new Date(Date.now() + duration * 60000);
    }

    control.status = 'active';
    control.currentState.isOn = true;
    control.currentState.intensity = intensity || 50;
    control.currentState.lastActivated = new Date();

    // Add to execution history
    control.executionHistory.push({
      action: 'activated',
      mode: 'manual',
      intensity: intensity || 50,
      duration: duration || 0,
      triggeredBy: 'manual',
      result: 'success'
    });

    await control.save();

    // Send control command via WebSocket to device
    wsService.broadcastControlUpdate(control.deviceId, control);

    // Send notification to user
    wsService.sendNotificationToUser(user._id, {
      type: 'control_activated',
      message: `${control.controlType} has been activated`,
      severity: 'info',
      deviceId: control.deviceId
    });

    res.json(control);
  } catch (error) {
    console.error('Activate control error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Manual control deactivation
router.post('/:controlId/deactivate', auth, async (req, res) => {
  try {
    const { controlId } = req.params;
    const wsService = req.app.get('wsService');

    const control = await Control.findById(controlId);
    if (!control) {
      return res.status(404).json({ message: 'Control not found' });
    }

    // Check device access
    const device = await Device.findById(control.deviceId);
    const user = req.userDoc;

    if (!userHasDeviceAccess(user, device)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update manual settings
    control.manualSettings.isOn = false;
    control.manualSettings.endTime = new Date();
    control.status = 'inactive';
    control.currentState.isOn = false;
    control.currentState.intensity = 0;
    control.currentState.lastDeactivated = new Date();

    // Calculate runtime
    if (control.currentState.lastActivated) {
      const runtime = Math.floor((Date.now() - control.currentState.lastActivated) / 60000);
      control.currentState.totalRuntime += runtime;
    }

    // Add to execution history
    control.executionHistory.push({
      action: 'deactivated',
      mode: 'manual',
      triggeredBy: 'manual',
      result: 'success'
    });

    await control.save();

    // Send control command via WebSocket to device
    wsService.broadcastControlUpdate(control.deviceId, control);

    // Send notification to user
    wsService.sendNotificationToUser(user._id, {
      type: 'control_deactivated',
      message: `${control.controlType} has been deactivated`,
      severity: 'info',
      deviceId: control.deviceId
    });

    res.json(control);
  } catch (error) {
    console.error('Deactivate control error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get control execution history
router.get('/:controlId/history', auth, async (req, res) => {
  try {
    const { controlId } = req.params;
    const { limit = 50, page = 1 } = req.query;

    const control = await Control.findById(controlId);
    if (!control) {
      return res.status(404).json({ message: 'Control not found' });
    }

    // Check device access
    const device = await Device.findById(control.deviceId);
    const user = req.userDoc;

    if (!userHasDeviceAccess(user, device)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const skip = (page - 1) * limit;
    const history = control.executionHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(skip, skip + parseInt(limit));

    res.json({
      history,
      total: control.executionHistory.length,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get control history error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete control
router.delete('/:controlId', auth, async (req, res) => {
  try {
    const { controlId } = req.params;
    const wsService = req.app.get('wsService');

    const control = await Control.findById(controlId);
    if (!control) {
      return res.status(404).json({ message: 'Control not found' });
    }

    // Check device access
    const device = await Device.findById(control.deviceId);
    const user = req.userDoc;

    if (!userHasDeviceAccess(user, device)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Soft delete
    control.isActive = false;
    await control.save();

    // Send real-time update
    wsService.broadcastControlUpdate(control.deviceId, { 
      ...control.toObject(), 
      deleted: true 
    });

    res.json({ message: 'Control deleted successfully' });
  } catch (error) {
    console.error('Delete control error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get control states from MQTT cache
router.get('/states/:deviceId', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const mqttService = req.app.get('mqttService');
    const user = req.userDoc;

    // Check device access
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    if (!userHasDeviceAccess(user, device)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get control states from MQTT cache
    const controlStates = mqttService.getDeviceControlStates(device.deviceId);
    
    res.json({ 
      success: true, 
      source: 'mqtt',
      controls: controlStates 
    });
  } catch (error) {
    console.error('Get control states error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Set control state via MQTT
router.post('/states/:deviceId', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { controlType, enabled, intensity } = req.body;
    const mqttService = req.app.get('mqttService');
    const wsService = req.app.get('wsService');
    const user = req.userDoc;

    // Check device access
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    if (!userHasDeviceAccess(user, device)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Send control command via MQTT
    const action = enabled ? 'on' : 'off';
    const result = mqttService.controlDevice(
      device.deviceId,
      controlType,
      action,
      intensity || 100
    );

    // Broadcast update via WebSocket for real-time UI update
    wsService.broadcastControlUpdate(deviceId, {
      controlType,
      enabled,
      intensity: intensity || 100,
      timestamp: new Date().toISOString()
    });

    res.json({ 
      success: result.success,
      message: enabled ? `${controlType} đã bật` : `${controlType} đã tắt`,
      mqtt: result
    });
  } catch (error) {
    console.error('Set control state error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function for default control states
function getDefaultControlStates() {
  return {
    light: { enabled: false, intensity: 100 },
    fan: { enabled: false, intensity: 100 },
    pump: { enabled: false, intensity: 100 },
    watering: { enabled: false, intensity: 100 },
    heater: { enabled: false, intensity: 100 },
    cooler: { enabled: false, intensity: 100 },
    mist: { enabled: false, intensity: 100 }
  };
}

// Send direct control command to device (for preset controls)
router.post('/command', auth, async (req, res) => {
  try {
    const { deviceId, controlType, action, intensity } = req.body;
    const wsService = req.app.get('wsService');
    const mqttService = req.app.get('mqttService');
    const user = req.userDoc;

    // Check device access
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    if (!userHasDeviceAccess(user, device)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Create command payload
    const command = {
      type: controlType,
      action: action,
      intensity: intensity || 100,
      timestamp: new Date().toISOString(),
      userId: user._id
    };

    // Send command via MQTT
    const mqttResult = mqttService.controlDevice(
      device.deviceId,
      controlType,
      action,
      intensity || 100
    );
    console.log('MQTT control result:', mqttResult);

    // Broadcast control command via WebSocket (for UI updates)
    wsService.broadcastToDevice(deviceId, 'control_command', command);
    
    // Also broadcast control state update
    wsService.broadcastControlUpdate(deviceId, {
      controlType,
      enabled: action === 'on',
      intensity: intensity || 100,
      timestamp: new Date().toISOString()
    });

    // Also broadcast to user for UI feedback
    wsService.sendNotificationToUser(user._id, {
      type: 'control_command_sent',
      message: `Lệnh ${action} ${controlType} đã được gửi`,
      severity: mqttResult.success ? 'success' : 'info',
      deviceId: deviceId
    });

    res.json({ 
      success: mqttResult.success, 
      message: 'Control command sent',
      command,
      mqtt: mqttResult
    });
  } catch (error) {
    console.error('Control command error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Save automation/schedule settings
router.post('/automation', auth, async (req, res) => {
  try {
    const { deviceId, type, settings } = req.body;
    const user = req.userDoc;

    console.log('Automation request:', { deviceId, type, settings });

    // Check device access
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    if (!userHasDeviceAccess(user, device)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // For alerts, we don't need a specific controlType - use 'light' as default or map sensor to control
    let controlType = settings.action || settings.controlType;
    
    // Map sensor type to control type for alerts
    if (type === 'alert' && !controlType) {
      // Use 'alert' as controlType for sensor alerts
      controlType = 'alert';
    }
    
    // Default controlType for reminders
    if (type === 'reminder' && !controlType) {
      controlType = 'reminder';
    }

    // For alert and reminder, always create new (allow multiple)
    // For other types, find existing or create new
    let control;
    
    if (type === 'alert' || type === 'reminder') {
      // Always create new alert/reminder
      control = new Control({
        deviceId,
        userId: user._id,
        controlType,
        mode: type === 'alert' ? 'threshold' : 'scheduled'
      });
    } else {
      // Find existing or create new for schedule/sensor
      control = await Control.findOne({ 
        deviceId, 
        controlType,
        isActive: true 
      });

      if (!control) {
        control = new Control({
          deviceId,
          userId: user._id,
          controlType,
          mode: type === 'schedule' ? 'scheduled' : 'auto'
        });
      }
    }

    if (type === 'schedule') {
      control.scheduleSettings = {
        enabled: settings.enabled,
        schedules: [{
          time: settings.time,
          days: settings.days,
          action: settings.action,
          intensity: settings.actionValue,
          duration: settings.duration
        }]
      };
    } else if (type === 'sensor') {
      control.automaticSettings = {
        enabled: settings.enabled,
        triggers: [{
          sensorType: settings.trigger,
          condition: settings.condition,
          threshold: settings.value,
          action: settings.action,
          intensity: settings.actionValue
        }]
      };
    } else if (type === 'alert') {
      control.alertSettings = {
        enabled: settings.enabled,
        sensor: settings.sensor,
        conditionType: settings.conditionType,
        minValue: settings.minValue,
        maxValue: settings.maxValue,
        message: settings.message
      };
    } else if (type === 'reminder') {
      // Lưu nhắc nhở theo thời gian
      control.mode = 'scheduled';
      control.scheduleSettings = {
        enabled: settings.enabled !== false,
        schedules: [{
          time: settings.time,
          days: settings.days,
          action: 'notify',
          title: settings.title,
          message: settings.message
        }]
      };
    }

    console.log('Saving control:', JSON.stringify(control.toObject(), null, 2));
    
    await control.save();
    console.log('Control saved successfully:', control._id);
    
    await control.populate('userId', 'username fullName');

    res.status(201).json(control);
  } catch (error) {
    console.error('Save automation error:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get automations for a device
router.get('/automation/:deviceId', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const user = req.userDoc;

    // Check device access
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    if (!userHasDeviceAccess(user, device)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const controls = await Control.find({ 
      deviceId, 
      isActive: true,
      $or: [
        { 'scheduleSettings.enabled': true },
        { 'automaticSettings.enabled': true },
        { 'alertSettings.enabled': true }
      ]
    }).populate('userId', 'username fullName');

    // Extract automations from controls
    const schedules = [];
    const automations = [];
    const alerts = [];

    controls.forEach(control => {
      if (control.scheduleSettings?.enabled) {
        control.scheduleSettings.schedules?.forEach(s => {
          schedules.push({
            id: control._id,
            controlType: control.controlType,
            ...s
          });
        });
      }
      if (control.automaticSettings?.enabled) {
        control.automaticSettings.triggers?.forEach(t => {
          automations.push({
            id: control._id,
            controlType: control.controlType,
            ...t
          });
        });
      }
      if (control.alertSettings?.enabled) {
        alerts.push({
          id: control._id,
          controlType: control.controlType,
          ...control.alertSettings
        });
      }
    });

    res.json({ schedules, automations, alerts });
  } catch (error) {
    console.error('Get automations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;