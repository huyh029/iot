const express = require('express');
const router = express.Router();
const Reminder = require('../models/Reminder');
const AlertHistory = require('../models/AlertHistory');
const Device = require('../models/Device');
const User = require('../models/User');
const auth = require('../middleware/auth');
const emailService = require('../services/emailService');

// Get all reminders for a device
router.get('/device/:deviceId', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    // Verify device belongs to user or user is manager
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Thiết bị không tồn tại' });
    }

    const reminders = await Reminder.find({ 
      deviceId,
      userId: req.user.role === 'manager' ? { $exists: true } : req.user._id
    }).sort({ createdAt: -1 });

    res.json(reminders);
  } catch (error) {
    console.error('Get reminders error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Get alert history for a device
router.get('/device/:deviceId/history', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { limit = 50 } = req.query;

    const history = await AlertHistory.find({ deviceId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit));

    res.json(history);
  } catch (error) {
    console.error('Get alert history error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Create a new reminder
router.post('/', auth, async (req, res) => {
  try {
    const { deviceId, sensorType, condition, value, enabled, emailNotification, cooldown } = req.body;

    // Verify device exists
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Thiết bị không tồn tại' });
    }

    const reminder = new Reminder({
      deviceId,
      userId: req.user._id,
      sensorType,
      condition,
      value,
      enabled: enabled !== false,
      emailNotification: emailNotification !== false,
      cooldown: cooldown || 5
    });

    await reminder.save();
    res.status(201).json(reminder);
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Update a reminder
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { sensorType, condition, value, enabled, emailNotification, cooldown } = req.body;

    const reminder = await Reminder.findById(id);
    if (!reminder) {
      return res.status(404).json({ message: 'Nhắc nhở không tồn tại' });
    }

    // Check ownership
    if (reminder.userId.toString() !== req.user._id.toString() && req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Không có quyền' });
    }

    reminder.sensorType = sensorType || reminder.sensorType;
    reminder.condition = condition || reminder.condition;
    reminder.value = value !== undefined ? value : reminder.value;
    reminder.enabled = enabled !== undefined ? enabled : reminder.enabled;
    reminder.emailNotification = emailNotification !== undefined ? emailNotification : reminder.emailNotification;
    reminder.cooldown = cooldown !== undefined ? cooldown : reminder.cooldown;

    await reminder.save();
    res.json(reminder);
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Toggle reminder enabled/disabled
router.post('/:id/toggle', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const reminder = await Reminder.findById(id);
    if (!reminder) {
      return res.status(404).json({ message: 'Nhắc nhở không tồn tại' });
    }

    reminder.enabled = !reminder.enabled;
    await reminder.save();

    res.json(reminder);
  } catch (error) {
    console.error('Toggle reminder error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Delete a reminder
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const reminder = await Reminder.findById(id);
    if (!reminder) {
      return res.status(404).json({ message: 'Nhắc nhở không tồn tại' });
    }

    // Check ownership
    if (reminder.userId.toString() !== req.user._id.toString() && req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Không có quyền' });
    }

    await Reminder.findByIdAndDelete(id);
    res.json({ message: 'Đã xóa nhắc nhở' });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Check reminders for a device (called by ESP32 or backend scheduler)
router.post('/check/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { sensorData } = req.body; // { temperature, humidity, soil_moisture, light }

    // Find device by external deviceId
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ message: 'Thiết bị không tồn tại' });
    }

    // Get enabled reminders for this device
    const reminders = await Reminder.find({ 
      deviceId: device._id, 
      enabled: true 
    });

    const triggeredAlerts = [];
    const now = new Date();

    for (const reminder of reminders) {
      const sensorValue = sensorData[reminder.sensorType];
      if (sensorValue === undefined) continue;

      // Check if threshold is exceeded
      let isTriggered = false;
      if (reminder.condition === 'above' && sensorValue > reminder.value) {
        isTriggered = true;
      } else if (reminder.condition === 'below' && sensorValue < reminder.value) {
        isTriggered = true;
      }

      if (!isTriggered) continue;

      // Check cooldown
      if (reminder.lastTriggered) {
        const cooldownMs = reminder.cooldown * 60 * 1000;
        if (now - reminder.lastTriggered < cooldownMs) {
          continue; // Still in cooldown period
        }
      }

      // Update last triggered
      reminder.lastTriggered = now;
      await reminder.save();

      // Get user for email
      const user = await User.findById(reminder.userId);
      let emailSent = false;
      let emailError = null;

      // Send email notification if enabled
      if (reminder.emailNotification && user?.email) {
        try {
          const sensorLabels = {
            temperature: 'Nhiệt độ',
            humidity: 'Độ ẩm không khí',
            soil_moisture: 'Độ ẩm đất',
            light: 'Ánh sáng'
          };
          const sensorUnits = {
            temperature: '°C',
            humidity: '%',
            soil_moisture: '%',
            light: 'lux'
          };

          await emailService.sendEmail({
            to: user.email,
            subject: `⚠️ Cảnh báo: ${sensorLabels[reminder.sensorType]} ${reminder.condition === 'above' ? 'vượt' : 'dưới'} ngưỡng`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #4cbe00; color: white; padding: 20px; text-align: center;">
                  <h1 style="margin: 0;">🌱 Smart Garden Alert</h1>
                </div>
                <div style="padding: 20px; background: #f8fafc;">
                  <h2 style="color: #ef4444;">⚠️ Cảnh báo ngưỡng</h2>
                  <p><strong>Thiết bị:</strong> ${device.name}</p>
                  <p><strong>Cảm biến:</strong> ${sensorLabels[reminder.sensorType]}</p>
                  <p><strong>Giá trị hiện tại:</strong> <span style="color: #ef4444; font-size: 1.5em;">${sensorValue}${sensorUnits[reminder.sensorType]}</span></p>
                  <p><strong>Ngưỡng cài đặt:</strong> ${reminder.condition === 'above' ? '>' : '<'} ${reminder.value}${sensorUnits[reminder.sensorType]}</p>
                  <p><strong>Thời gian:</strong> ${now.toLocaleString('vi-VN')}</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                  <p style="color: #64748b; font-size: 0.9em;">Email này được gửi tự động từ hệ thống Smart Garden.</p>
                </div>
              </div>
            `
          });
          emailSent = true;
          console.log(`✅ Alert email sent to ${user.email}`);
        } catch (err) {
          emailError = err.message;
          console.error(`❌ Failed to send alert email:`, err);
        }
      }

      // Save to alert history
      const alertRecord = new AlertHistory({
        reminderId: reminder._id,
        deviceId: device._id,
        userId: reminder.userId,
        sensorType: reminder.sensorType,
        condition: reminder.condition,
        thresholdValue: reminder.value,
        actualValue: sensorValue,
        emailSent,
        emailError,
        timestamp: now
      });
      await alertRecord.save();

      triggeredAlerts.push({
        sensorType: reminder.sensorType,
        condition: reminder.condition,
        threshold: reminder.value,
        actual: sensorValue,
        emailSent
      });
    }

    res.json({ 
      checked: reminders.length,
      triggered: triggeredAlerts.length,
      alerts: triggeredAlerts
    });
  } catch (error) {
    console.error('Check reminders error:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

module.exports = router;
