const Control = require('../models/Control');
const SensorData = require('../models/SensorData');
const User = require('../models/User');
const emailService = require('./emailService');

class ThresholdService {
  static async checkThresholds(wsService) {
    try {
      // Find all threshold controls
      const thresholdControls = await Control.find({
        mode: 'threshold',
        isActive: true,
        'thresholdSettings.conditions': { $exists: true, $ne: [] }
      }).populate('deviceId', 'name location');

      for (const control of thresholdControls) {
        await this.evaluateThresholdConditions(control, wsService);
      }

      console.log(`Checked thresholds for ${thresholdControls.length} controls`);
    } catch (error) {
      console.error('Threshold service error:', error);
    }
  }

  static async evaluateThresholdConditions(control, wsService) {
    try {
      const { conditions, notifications } = control.thresholdSettings;

      for (const condition of conditions) {
        // Get latest sensor data for the condition
        const latestSensorData = await SensorData.findOne({
          deviceId: control.deviceId._id,
          sensorType: condition.sensorType
        }).sort({ timestamp: -1 });

        if (!latestSensorData) continue;

        const sensorValue = latestSensorData.value;
        const conditionMet = this.evaluateCondition(sensorValue, condition.operator, condition.value);

        if (conditionMet) {
          await this.triggerThresholdAction(control, condition, sensorValue, wsService);
        }
      }
    } catch (error) {
      console.error('Evaluate threshold conditions error:', error);
    }
  }

  static evaluateCondition(sensorValue, operator, thresholdValue) {
    switch (operator) {
      case '>':
        return sensorValue > thresholdValue;
      case '<':
        return sensorValue < thresholdValue;
      case '>=':
        return sensorValue >= thresholdValue;
      case '<=':
        return sensorValue <= thresholdValue;
      case '==':
        return sensorValue === thresholdValue;
      default:
        return false;
    }
  }

  static async triggerThresholdAction(control, condition, sensorValue, wsService) {
    try {
      // Check if control is already active to prevent rapid triggering
      if (control.status === 'active') {
        return;
      }

      // Activate control with threshold settings
      control.status = 'active';
      control.currentState.isOn = true;
      control.currentState.intensity = condition.action.intensity;
      control.currentState.lastActivated = new Date();

      // Set duration if specified
      if (condition.action.duration > 0) {
        control.manualSettings.endTime = new Date(Date.now() + condition.action.duration * 60000);
      }

      // Add to execution history
      control.executionHistory.push({
        action: 'activated',
        mode: 'threshold',
        intensity: condition.action.intensity,
        duration: condition.action.duration,
        triggeredBy: `threshold: ${condition.sensorType} ${condition.operator} ${condition.value}`,
        result: 'success'
      });

      await control.save();

      // Send real-time control update
      wsService.broadcastControlUpdate(control.deviceId._id, control);

      // Send notifications if enabled
      if (condition.notifications?.enabled) {
        const message = `Threshold triggered: ${condition.sensorType} is ${sensorValue} (${condition.operator} ${condition.value}). ${control.controlType} activated.`;

        for (const method of condition.notifications.methods) {
          if (method === 'websocket') {
            wsService.sendNotificationToUser(control.userId, {
              type: 'threshold_triggered',
              message,
              severity: 'warning',
              deviceId: control.deviceId._id,
              controlId: control._id,
              sensorValue,
              threshold: condition.value
            });
          }
          
          // Send email notification
          if (method === 'email') {
            await this.sendEmailNotification(control, condition, sensorValue);
          }
        }
      }

      console.log(`Threshold triggered for ${control.controlType} on device ${control.deviceId.name}`);
    } catch (error) {
      console.error('Trigger threshold action error:', error);
    }
  }

  // Gửi email thông báo khi vượt ngưỡng
  static async sendEmailNotification(control, condition, sensorValue) {
    try {
      // Lấy thông tin user để gửi email
      const user = await User.findById(control.userId);
      if (!user || !user.email) {
        console.log('No user email found for notification');
        return;
      }

      const conditionType = condition.operator === '>' || condition.operator === '>=' ? 'above' : 'below';
      
      await emailService.sendThresholdAlert(user.email, {
        deviceName: control.deviceId.name || 'Unknown Device',
        sensorType: condition.sensorType,
        value: sensorValue,
        threshold: condition.value,
        condition: conditionType
      });

      // Gửi thông báo điều khiển tự động
      await emailService.sendAutoControlNotification(user.email, {
        deviceName: control.deviceId.name || 'Unknown Device',
        controlType: control.controlType,
        action: 'on',
        reason: `${condition.sensorType} ${condition.operator} ${condition.value} (hiện tại: ${sensorValue})`
      });

    } catch (error) {
      console.error('Send email notification error:', error);
    }
  }

  static async checkAutoDeactivation(wsService) {
    try {
      // Find controls that should be auto-deactivated (duration expired)
      const activeControls = await Control.find({
        status: 'active',
        'manualSettings.endTime': { $lte: new Date() }
      }).populate('deviceId', 'name');

      for (const control of activeControls) {
        await this.deactivateControl(control, wsService);
      }

      if (activeControls.length > 0) {
        console.log(`Auto-deactivated ${activeControls.length} controls`);
      }
    } catch (error) {
      console.error('Auto deactivation check error:', error);
    }
  }

  static async deactivateControl(control, wsService) {
    try {
      // Calculate runtime
      if (control.currentState.lastActivated) {
        const runtime = Math.floor((Date.now() - control.currentState.lastActivated) / 60000);
        control.currentState.totalRuntime += runtime;
      }

      // Update control state
      control.status = 'inactive';
      control.currentState.isOn = false;
      control.currentState.intensity = 0;
      control.currentState.lastDeactivated = new Date();

      // Add to execution history
      control.executionHistory.push({
        action: 'deactivated',
        mode: control.mode,
        triggeredBy: 'auto_timeout',
        result: 'success'
      });

      await control.save();

      // Send real-time update
      wsService.broadcastControlUpdate(control.deviceId._id, control);

      // Send notification
      wsService.sendNotificationToUser(control.userId, {
        type: 'control_auto_deactivated',
        message: `${control.controlType} automatically deactivated after timeout`,
        severity: 'info',
        deviceId: control.deviceId._id,
        controlId: control._id
      });
    } catch (error) {
      console.error('Deactivate control error:', error);
    }
  }
}

module.exports = ThresholdService;