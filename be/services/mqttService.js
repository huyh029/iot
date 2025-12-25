const mqtt = require('mqtt');
const EventEmitter = require('events');

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

  handleTelemetry(deviceId, data) {
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

    // Emit event for other services
    this.emit('telemetry', { deviceId, data: updated });

    // Broadcast via WebSocket
    if (this.wsService) {
      this.wsService.broadcastSensorData({ deviceId, ...updated });
    }
  }

  handleStatus(deviceId, data) {
    console.log(`📡 Device ${deviceId} status:`, data.status);
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
