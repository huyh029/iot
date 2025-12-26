const mqtt = require('mqtt');
const EventEmitter = require('events');
const Device = require('../models/Device');
const Control = require('../models/Control');
const emailService = require('./emailService');

// Alert cooldown tracking
const alertCooldowns = new Map();
const ALERT_COOLDOWN = 5 * 60 * 1000; // 5 minutes

class MQTTService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.wsService = null;
    this.connected = false;

    // Config from env - REQUIRED
    this.broker = process.env.ESP32_MQTT_BROKER;
    this.port = parseInt(process.env.ESP32_MQTT_PORT);
    this.topicPrefix = process.env.ESP32_TOPIC_PREFIX;

    // Validate required env vars
    if (!this.broker || !this.port || !this.topicPrefix) {
      console.error('❌ Missing MQTT config in environment variables');
      console.error('Required: ESP32_MQTT_BROKER, ESP32_MQTT_PORT, ESP32_TOPIC_PREFIX');
      return;
    }

    // Cache telemetry per device
    this.deviceTelemetryCache = new Map();
    // Cache control states per device
    this.deviceControlCache = new Map();

    this.connect();
  }

  connect() {
    if (!this.broker) {
      console.error('❌ Cannot connect - MQTT broker not configured');
      return;
    }

    // Handle broker URL - remove protocol if already included
    let brokerHost = this.broker;
    if (brokerHost.startsWith('mqtt://') || brokerHost.startsWith('mqtts://')) {
      brokerHost = brokerHost.replace(/^mqtts?:\/\//, '');
    }

    const brokerUrl = `mqtt://${brokerHost}:${this.port}`;
    console.log(`🔌 Connecting to MQTT broker...`);
    console.log(`📋 MQTT Config: broker=${brokerHost}, port=${this.port}, topicPrefix=${this.topicPrefix}`);

    this.client = mqtt.connect(brokerUrl, {
      clientId: `smartgarden_server_${Date.now()}`,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 10000
    });

    this.client.on('connect', () => {
      console.log('✅ Connected to MQTT broker');
      this.connected = true;
      
      // Subscribe to all device topics
      const topics = [
        `${this.topicPrefix}/+/telemetry`,    // Device sends sensor data
        `${this.topicPrefix}/+/status`,       // Device status (online/offline)
        `${this.topicPrefix}/+/control/ack`   // Device acknowledges control command
      ];
      
      topics.forEach(topic => {
        this.client.subscribe(topic, (err) => {
          if (err) {
            console.error(`❌ Subscribe error for ${topic}:`, err);
          } else {
            console.log(`✅ Subscribed to: ${topic}`);
          }
        });
      });
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });

    this.client.on('error', (err) => {
      console.error('❌ MQTT error:', err.message);
    });

    this.client.on('close', () => {
      console.log('📴 MQTT connection closed');
      this.connected = false;
    });

    this.client.on('reconnect', () => {
      console.log('🔄 MQTT reconnecting...');
    });
  }

  handleMessage(topic, message) {
    try {
      const data = JSON.parse(message.toString());
      const parts = topic.split('/');
      const deviceId = parts[1]; // smartgarden/{deviceId}/...
      const messageType = parts[2];

      console.log(`📥 MQTT [${deviceId}] ${messageType}:`, data);

      switch (messageType) {
        case 'telemetry':
          this.handleTelemetry(deviceId, data);
          break;
        case 'status':
          this.handleStatus(deviceId, data);
          break;
        case 'control':
          if (parts[3] === 'ack') {
            this.handleControlAck(deviceId, data);
          }
          break;
      }
    } catch (err) {
      console.error('❌ MQTT message parse error:', err);
    }
  }

  async handleTelemetry(deviceId, data) {
    // Update cache
    const existing = this.deviceTelemetryCache.get(deviceId) || {};
    const updated = {
      temperature: data.temperature ?? existing.temperature,
      humidity: data.humidity ?? existing.humidity,
      light: data.light ?? existing.light,
      soil_moisture: data.soil_moisture ?? existing.soil_moisture,
      wind: data.wind ?? existing.wind,
      timestamp: new Date().toISOString()
    };
    this.deviceTelemetryCache.set(deviceId, updated);

    // === UPDATE DEVICE STATUS & LASTSEEN IN DATABASE ===
    try {
      const device = await Device.findOne({ deviceId: deviceId });
      if (device) {
        const wasOffline = device.status !== 'online';
        device.status = 'online';
        device.lastSeen = new Date();
        await device.save();
        
        console.log(`📡 Device ${deviceId} heartbeat via MQTT (lastSeen: ${device.lastSeen.toISOString()})`);
        
        // Broadcast status change if device was offline
        if (wasOffline && this.wsService) {
          this.wsService.broadcastDeviceStatus(device._id.toString(), 'online');
        }
      }
    } catch (err) {
      console.error(`❌ Failed to update device ${deviceId} status:`, err.message);
    }
    // === END UPDATE ===

    // === CHECK ALERTS ===
    await this.checkAlerts(deviceId, updated);
    // === END CHECK ALERTS ===

    // Emit event for other services
    this.emit('telemetry', { deviceId, data: updated });

    // Broadcast via WebSocket
    if (this.wsService) {
      this.wsService.broadcastSensorData({ deviceId, ...updated });
    }
  }

  async checkAlerts(deviceId, sensorData) {
    try {
      const device = await Device.findOne({ deviceId: deviceId }).populate('ownerId', 'email fullName');
      if (!device) return;

      const alertControls = await Control.find({
        deviceId: device._id,
        controlType: 'alert',
        isActive: true,
        'alertSettings.enabled': true
      });

      if (alertControls.length === 0) return;
      
      console.log(`🔔 MQTT: Checking ${alertControls.length} alerts for device ${device.name}`);

      for (const control of alertControls) {
        const alertSetting = control.alertSettings;
        if (!alertSetting) continue;

        const sensorValue = sensorData[alertSetting.sensor];
        if (sensorValue === null || sensorValue === undefined) continue;

        let shouldAlert = false;
        let alertCondition = '';

        // FE: above dùng minValue (> minValue), below dùng maxValue (< maxValue)
        if (alertSetting.conditionType === 'above' && sensorValue > alertSetting.minValue) {
          shouldAlert = true;
          alertCondition = 'above';
        } else if (alertSetting.conditionType === 'below' && sensorValue < alertSetting.maxValue) {
          shouldAlert = true;
          alertCondition = 'below';
        } else if (alertSetting.conditionType === 'range') {
          if (sensorValue < alertSetting.minValue) {
            shouldAlert = true;
            alertCondition = 'below';
          } else if (sensorValue > alertSetting.maxValue) {
            shouldAlert = true;
            alertCondition = 'above';
          }
        }

        if (shouldAlert) {
          const cooldownKey = `${deviceId}_alert_${alertSetting.sensor}`;
          const lastAlert = alertCooldowns.get(cooldownKey);
          const now = Date.now();

          if (!lastAlert || (now - lastAlert) > ALERT_COOLDOWN) {
            alertCooldowns.set(cooldownKey, now);

            const thresholdValue = alertCondition === 'above' ? alertSetting.minValue : alertSetting.maxValue;

            console.log(`🔔 Alert triggered: ${alertSetting.sensor} ${alertCondition} ${thresholdValue} (current: ${sensorValue})`);

            // Send WebSocket notification
            if (this.wsService && device.ownerId?._id) {
              this.wsService.sendNotificationToUser(device.ownerId._id.toString(), {
                type: 'sensor_alert',
                message: alertSetting.message || `⚠️ ${device.name}: ${alertSetting.sensor} ${alertCondition === 'above' ? 'vượt' : 'dưới'} ngưỡng - Hiện tại: ${sensorValue}`,
                severity: 'warning',
                deviceId: device._id,
                sensorType: alertSetting.sensor,
                value: sensorValue
              });
            }

            // Send email alert
            if (device.ownerId?.email) {
              await emailService.sendThresholdAlert(device.ownerId.email, {
                deviceName: device.name,
                sensorType: alertSetting.sensor,
                value: sensorValue,
                threshold: thresholdValue,
                condition: alertCondition
              });
              console.log(`📧 Alert email sent to ${device.ownerId.email}`);
            }
          }
        }
      }
    } catch (err) {
      console.error('❌ Check alerts error:', err.message);
    }
  }

  async handleStatus(deviceId, data) {
    console.log(`📡 Device ${deviceId} status:`, data.status);
    
    // Update device status in database
    try {
      const device = await Device.findOne({ deviceId: deviceId });
      if (device) {
        device.status = data.status;
        device.lastSeen = new Date();
        await device.save();
        console.log(`📡 Device ${deviceId} status updated to ${data.status}`);
      }
    } catch (err) {
      console.error(`❌ Failed to update device ${deviceId} status:`, err.message);
    }
    
    this.emit('status', { deviceId, status: data.status });
    
    if (this.wsService) {
      this.wsService.broadcastDeviceStatus(deviceId, data.status);
    }
  }

  handleControlAck(deviceId, data) {
    console.log(`✅ Device ${deviceId} acknowledged control:`, data);
    this.emit('controlAck', { deviceId, ...data });
  }

  setWsService(wsService) {
    this.wsService = wsService;
  }

  // Get cached telemetry for a device
  getDeviceTelemetry(deviceId) {
    return this.deviceTelemetryCache.get(deviceId) || null;
  }

  // Get cached control states for a device
  getDeviceControlStates(deviceId) {
    return this.deviceControlCache.get(deviceId) || {
      light: { enabled: false, intensity: 100 },
      fan: { enabled: false, intensity: 100 },
      pump: { enabled: false, intensity: 100 },
      watering: { enabled: false, intensity: 100 },
      heater: { enabled: false, intensity: 100 },
      cooler: { enabled: false, intensity: 100 },
      mist: { enabled: false, intensity: 100 }
    };
  }

  // Send control command to device
  controlDevice(deviceId, controlType, action, intensity = 100) {
    if (!this.connected) {
      console.error('❌ MQTT not connected');
      return { success: false, error: 'MQTT not connected' };
    }

    const topic = `${this.topicPrefix}/${deviceId}/control`;
    const payload = {
      type: controlType,
      action: action, // 'on' or 'off'
      intensity: intensity,
      timestamp: Date.now()
    };

    this.client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) {
        console.error(`❌ Failed to publish control to ${deviceId}:`, err);
      } else {
        console.log(`📤 Control sent to ${deviceId}:`, payload);
      }
    });

    // Update local cache
    const states = this.deviceControlCache.get(deviceId) || {};
    states[controlType] = {
      enabled: action === 'on',
      intensity: intensity
    };
    this.deviceControlCache.set(deviceId, states);

    return { success: true, payload };
  }

  // Publish telemetry (for testing/simulation)
  publishTelemetry(deviceId, data) {
    if (!this.connected) return false;

    const topic = `${this.topicPrefix}/${deviceId}/telemetry`;
    this.client.publish(topic, JSON.stringify(data));
    return true;
  }

  // Request device to send current state
  requestDeviceState(deviceId) {
    if (!this.connected) return false;

    const topic = `${this.topicPrefix}/${deviceId}/request`;
    this.client.publish(topic, JSON.stringify({ type: 'getState' }));
    return true;
  }
}

// Singleton
const mqttService = new MQTTService();
module.exports = mqttService;
