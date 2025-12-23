const Control = require('../models/Control');
const moment = require('moment-timezone');
const thingsBoardService = require('./thingsboard');

class SchedulerService {
  static async checkScheduledControls(wsService) {
    try {
      const now = moment().tz('Asia/Ho_Chi_Minh');
      const currentDay = now.format('dddd').toLowerCase();
      const currentTime = now.format('HH:mm');

      // Find all scheduled controls
      const scheduledControls = await Control.find({
        mode: 'scheduled',
        isActive: true,
        'scheduleSettings.schedules': { $exists: true, $ne: [] }
      }).populate('deviceId', 'name location thingsboard');

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
      }).populate('deviceId', 'name thingsboard');

      for (const control of controls) {
        if (!control.scheduleSettings?.schedules) continue;

        for (const schedule of control.scheduleSettings.schedules) {
          if (!schedule.days?.includes(currentDay)) continue;

          // Check if current time matches
          if (schedule.time === currentTime) {
            console.log(`⏰ Schedule triggered: ${control.controlType} at ${currentTime}`);
            
            // Send command to ThingsBoard
            const tbToken = control.deviceId?.thingsboard?.accessToken;
            if (tbToken) {
              const result = await thingsBoardService.controlDevice(
                tbToken,
                schedule.action || control.controlType,
                'on',
                schedule.intensity || 100
              );
              console.log('ThingsBoard scheduled control result:', result);

              // If duration is set, schedule auto-off
              if (schedule.duration && schedule.duration > 0) {
                setTimeout(async () => {
                  await thingsBoardService.controlDevice(
                    tbToken,
                    schedule.action || control.controlType,
                    'off',
                    0
                  );
                  console.log(`⏰ Auto-off after ${schedule.duration} minutes`);
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
      // Send command to ThingsBoard if device has token
      const tbToken = control.deviceId?.thingsboard?.accessToken;
      if (tbToken) {
        const result = await thingsBoardService.controlDevice(
          tbToken,
          control.controlType,
          'on',
          schedule.intensity || 100
        );
        console.log('ThingsBoard activation result:', result);
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
      // Send command to ThingsBoard if device has token
      const tbToken = control.deviceId?.thingsboard?.accessToken;
      if (tbToken) {
        const result = await thingsBoardService.controlDevice(
          tbToken,
          control.controlType,
          'off',
          0
        );
        console.log('ThingsBoard deactivation result:', result);
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
      }).populate('deviceId', 'name thingsboard');

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
            
            // Send command to ThingsBoard
            const tbToken = control.deviceId?.thingsboard?.accessToken;
            if (tbToken) {
              await thingsBoardService.controlDevice(
                tbToken,
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
