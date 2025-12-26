const Control = require('../models/Control');
const mqttService = require('./mqttService');

class SchedulerService {
  static async checkScheduledControls(wsService) {
    try {
      // Get current time in Vietnam timezone
      const now = new Date();
      const vnTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = days[vnTime.getDay()];
      const currentTime = vnTime.toTimeString().slice(0, 5); // HH:mm
      
      console.log(`⏰ Scheduler: ${currentDay} ${currentTime}`);

      // Find all scheduled controls
      const scheduledControls = await Control.find({
        mode: 'scheduled',
        isActive: true,
        'scheduleSettings.schedules': { $exists: true, $ne: [] }
      }).populate('deviceId', 'name location deviceId');

      for (const control of scheduledControls) {
        for (const schedule of control.scheduleSettings.schedules) {
          if (!schedule.isActive) continue;

          // Check if today is in the scheduled days
          if (!schedule.days.includes(currentDay)) continue;

          // Check if current time matches start time
          if (schedule.startTime === currentTime) {
            await this.activateScheduledControl(control, schedule, wsService);
          }

          // Check if current time matches end time
          if (schedule.endTime === currentTime) {
            await this.deactivateScheduledControl(control, schedule, wsService);
          }
        }
      }

      // Also check automations saved in DB (from frontend)
      await this.checkSavedSchedules(wsService, currentDay, currentTime);
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  }

  // Check schedules saved from frontend (in scheduleSettings)
  static async checkSavedSchedules(wsService, currentDay, currentTime) {
    try {
      const controls = await Control.find({
        isActive: true,
        'scheduleSettings.enabled': true,
        'scheduleSettings.schedules': { $exists: true, $ne: [] }
      }).populate('deviceId', 'name deviceId');

      console.log(`⏰ Checking schedules: ${currentDay} ${currentTime}, found ${controls.length} controls`);

      for (const control of controls) {
        if (!control.scheduleSettings?.schedules) continue;

        for (const schedule of control.scheduleSettings.schedules) {
          console.log(`⏰ Schedule: ${control.controlType} at ${schedule.time}, days: ${schedule.days?.join(',')}, current: ${currentDay} ${currentTime}`);
          
          if (!schedule.days?.includes(currentDay)) {
            console.log(`⏰ Day not matched, skipping`);
            continue;
          }

          // Check if current time matches
          if (schedule.time === currentTime) {
            console.log(`⏰ Schedule triggered: ${control.controlType} at ${currentTime}`);
            
            // Send command via MQTT
            const espDeviceId = control.deviceId?.deviceId;
            if (espDeviceId) {
              // Map action names to ESP32 control names
              const actionMap = {
                'water': 'pump',      // water -> pump
                'irrigation': 'pump'  // irrigation -> pump
              };
              const controlType = actionMap[schedule.action] || schedule.action || control.controlType;
              
              mqttService.controlDevice(
                espDeviceId,
                controlType,
                'on',
                schedule.intensity || 100
              );
              console.log(`MQTT scheduled control sent: ${controlType}`);
              // If duration is set, schedule auto-off
              if (schedule.duration && schedule.duration > 0) {
                const offControlType = controlType; // Use same mapped type
                setTimeout(() => {
                  mqttService.controlDevice(
                    espDeviceId,
                    offControlType,
                    'off',
                    0
                  );
                  console.log(`⏰ Auto-off ${offControlType} after ${schedule.duration} minutes`);
                }, schedule.duration * 60 * 1000);
              }
            }

            // Broadcast to WebSocket
            wsService.broadcastControlUpdate(control.deviceId._id, {
              ...control.toObject(),
              triggered: true,
              triggeredAt: new Date()
            });
          }
        }
      }
    } catch (error) {
      console.error('Check saved schedules error:', error);
    }
  }

  static async activateScheduledControl(control, schedule, wsService) {
    try {
      // Send command via MQTT
      const espDeviceId = control.deviceId?.deviceId;
      if (espDeviceId) {
        mqttService.controlDevice(
          espDeviceId,
          control.controlType,
          'on',
          schedule.intensity || 100
        );
        console.log('MQTT activation sent');
      }

      // Update control state
      control.status = 'active';
      control.currentState.isOn = true;
      control.currentState.intensity = schedule.intensity;
      control.currentState.lastActivated = new Date();

      // Add to execution history
      control.executionHistory.push({
        action: 'activated',
        mode: 'scheduled',
        intensity: schedule.intensity,
        triggeredBy: 'schedule',
        result: 'success'
      });

      await control.save();

      // Send real-time update
      wsService.broadcastControlUpdate(control.deviceId._id, control);

      // Send notification to device owner
      wsService.sendNotificationToUser(control.userId, {
        type: 'scheduled_activation',
        message: `${control.controlType} activated by schedule at ${control.deviceId.name}`,
        severity: 'info',
        deviceId: control.deviceId._id
      });

      console.log(`Scheduled activation: ${control.controlType} on device ${control.deviceId.name}`);
    } catch (error) {
      console.error('Scheduled activation error:', error);
    }
  }

  static async deactivateScheduledControl(control, schedule, wsService) {
    try {
      // Send command via MQTT
      const espDeviceId = control.deviceId?.deviceId;
      if (espDeviceId) {
        mqttService.controlDevice(
          espDeviceId,
          control.controlType,
          'off',
          0
        );
        console.log('MQTT deactivation sent');
      }

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
        mode: 'scheduled',
        triggeredBy: 'schedule',
        result: 'success'
      });

      await control.save();

      // Send real-time update
      wsService.broadcastControlUpdate(control.deviceId._id, control);

      // Send notification to device owner
      wsService.sendNotificationToUser(control.userId, {
        type: 'scheduled_deactivation',
        message: `${control.controlType} deactivated by schedule at ${control.deviceId.name}`,
        severity: 'info',
        deviceId: control.deviceId._id
      });

      console.log(`Scheduled deactivation: ${control.controlType} on device ${control.deviceId.name}`);
    } catch (error) {
      console.error('Scheduled deactivation error:', error);
    }
  }

  // Check sensor-based automations
  static async checkSensorAutomations(wsService, deviceId, sensorData) {
    try {
      const controls = await Control.find({
        deviceId: deviceId,
        isActive: true,
        'automaticSettings.enabled': true,
        'automaticSettings.triggers': { $exists: true, $ne: [] }
      }).populate('deviceId', 'name deviceId');

      for (const control of controls) {
        if (!control.automaticSettings?.triggers) continue;

        for (const trigger of control.automaticSettings.triggers) {
          const sensorValue = sensorData[trigger.sensorType];
          if (sensorValue === undefined) continue;

          let shouldTrigger = false;
          
          if (trigger.condition === 'above' && sensorValue > trigger.threshold) {
            shouldTrigger = true;
          } else if (trigger.condition === 'below' && sensorValue < trigger.threshold) {
            shouldTrigger = true;
          }

          if (shouldTrigger && !control.currentState.isOn) {
            console.log(`🤖 Sensor automation triggered: ${trigger.sensorType} ${trigger.condition} ${trigger.threshold}`);
            
            // Send command via MQTT
            const espDeviceId = control.deviceId?.deviceId;
            if (espDeviceId) {
              mqttService.controlDevice(
                espDeviceId,
                trigger.action || control.controlType,
                'on',
                trigger.intensity || 100
              );
            }

            // Update control state
            control.currentState.isOn = true;
            control.currentState.intensity = trigger.intensity || 100;
            control.currentState.lastActivated = new Date();
            await control.save();

            wsService.broadcastControlUpdate(control.deviceId._id, control);
          }
        }
      }
    } catch (error) {
      console.error('Sensor automation error:', error);
    }
  }
}

module.exports = SchedulerService;
