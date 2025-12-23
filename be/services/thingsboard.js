const axios = require('axios');
const mqtt = require('mqtt');

// ThingsBoard Cloud Configuration (from .env except accessToken)
const THINGSBOARD_CONFIG = {
  host: process.env.THINGSBOARD_HOST || 'https://thingsboard.cloud',
  mqttHost: process.env.THINGSBOARD_MQTT_HOST || 'mqtt://thingsboard.cloud',
  mqttPort: parseInt(process.env.THINGSBOARD_MQTT_PORT) || 1883,
  provisionDeviceKey: process.env.THINGSBOARD_PROVISION_KEY || 'jyskj0yjdar6ovvb6bgj',
  provisionDeviceSecret: process.env.THINGSBOARD_PROVISION_SECRET || 'jq2npyt7yq8n9uas9d3a',
  // No default access token - each device has its own token in MongoDB
  username: process.env.THINGSBOARD_USERNAME,
  password: process.env.THINGSBOARD_PASSWORD
};

class ThingsBoardService {
  constructor() {
    this.baseUrl = THINGSBOARD_CONFIG.host;
    this.lastTelemetry = null;
    this.lastFetchTime = null;
    this.cacheTimeout = 5000; // 5 seconds cache
    this.mqttClient = null;
    this.wsService = null;
    
    // JWT token for REST API
    this.jwtToken = null;
    this.jwtExpireTime = null;
    
    // Cache device ID mapping (accessToken -> thingsboardDeviceId)
    this.deviceIdCache = new Map();
    
    // Store latest telemetry per device (deviceAccessToken -> telemetry)
    this.deviceTelemetryCache = new Map();

    // Don't connect MQTT by default - each device has its own token
    // MQTT connection can be established per-device if needed
    
    // Login to get JWT token for REST API
    this.login();
  }
  
  // Login to ThingsBoard and get JWT token
  async login() {
    try {
      if (!THINGSBOARD_CONFIG.username || !THINGSBOARD_CONFIG.password) {
        console.log('⚠️ ThingsBoard credentials not configured, JWT API disabled');
        return null;
      }
      
      const url = `${this.baseUrl}/api/auth/login`;
      const response = await axios.post(url, {
        username: THINGSBOARD_CONFIG.username,
        password: THINGSBOARD_CONFIG.password
      }, { timeout: 10000 });
      
      this.jwtToken = response.data.token;
      this.jwtExpireTime = Date.now() + 3600000; // 1 hour
      console.log('✅ ThingsBoard JWT login successful');
      return this.jwtToken;
    } catch (error) {
      console.error('❌ ThingsBoard JWT login failed:', error.response?.data?.message || error.message);
      return null;
    }
  }
  
  // Get valid JWT token (refresh if expired)
  async getJwtToken() {
    if (!this.jwtToken || Date.now() > this.jwtExpireTime - 60000) {
      await this.login();
    }
    return this.jwtToken;
  }
  
  // Get ThingsBoard device ID by access token
  async getDeviceIdByToken(accessToken) {
    // Check cache first
    if (this.deviceIdCache.has(accessToken)) {
      return this.deviceIdCache.get(accessToken);
    }
    
    try {
      const token = await this.getJwtToken();
      if (!token) return null;
      
      // Search for device by credentials - ThingsBoard Cloud API
      // First get all devices, then find by access token
      const url = `${this.baseUrl}/api/tenant/devices?pageSize=100&page=0`;
      const response = await axios.get(url, {
        headers: { 'X-Authorization': `Bearer ${token}` },
        timeout: 10000
      });
      
      const devices = response.data?.data || [];
      
      // For each device, check if access token matches
      for (const device of devices) {
        try {
          const credUrl = `${this.baseUrl}/api/device/${device.id.id}/credentials`;
          const credResponse = await axios.get(credUrl, {
            headers: { 'X-Authorization': `Bearer ${token}` },
            timeout: 5000
          });
          
          if (credResponse.data?.credentialsId === accessToken) {
            this.deviceIdCache.set(accessToken, device.id.id);
            console.log(`✅ Got ThingsBoard device ID: ${device.id.id} for token: ${accessToken.substring(0, 8)}...`);
            return device.id.id;
          }
        } catch (e) {
          // Skip device if can't get credentials
        }
      }
      
      console.log(`⚠️ Device not found for token: ${accessToken.substring(0, 8)}...`);
      return null;
    } catch (error) {
      console.error('Get device ID error:', error.response?.data?.message || error.message);
      return null;
    }
  }

  // Set WebSocket service for broadcasting updates
  setWsService(wsService) {
    this.wsService = wsService;
  }

  // Connect to ThingsBoard MQTT broker for a specific device
  connectMQTT(accessToken) {
    if (!accessToken) {
      console.log('⚠️ No access token provided for MQTT connection');
      return;
    }
    
    try {
      const mqttUrl = `${THINGSBOARD_CONFIG.mqttHost}:${THINGSBOARD_CONFIG.mqttPort}`;
      console.log('Connecting to ThingsBoard MQTT:', mqttUrl);

      this.mqttClient = mqtt.connect(mqttUrl, {
        username: accessToken,
        clientId: `smartgarden_${Date.now()}`,
        clean: true,
        reconnectPeriod: 5000,
        connectTimeout: 10000
      });

      this.mqttClient.on('connect', () => {
        console.log('✅ Connected to ThingsBoard MQTT');
        
        // Subscribe to attributes response topic (for reading attributes)
        this.mqttClient.subscribe('v1/devices/me/attributes/response/+', (err) => {
          if (err) {
            console.error('MQTT attributes response subscribe error:', err);
          } else {
            console.log('✅ Subscribed to attributes response topic');
          }
        });

        // Subscribe to attribute updates (when server pushes new shared attributes)
        this.mqttClient.subscribe('v1/devices/me/attributes', (err) => {
          if (err) {
            console.error('MQTT attributes subscribe error:', err);
          } else {
            console.log('✅ Subscribed to attributes topic');
          }
        });

        // Subscribe to RPC requests from server
        this.mqttClient.subscribe('v1/devices/me/rpc/request/+', (err) => {
          if (err) {
            console.error('MQTT RPC subscribe error:', err);
          } else {
            console.log('✅ Subscribed to RPC request topic');
          }
        });

        // Request current shared attributes
        this.mqttClient.publish('v1/devices/me/attributes/request/1', JSON.stringify({
          sharedKeys: 'temperature,humidity,light,soil_moisture,wind'
        }));
      });

      this.mqttClient.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('📥 MQTT message received:', topic, data);
          
          // Handle different topics differently
          if (topic.startsWith('v1/devices/me/attributes/response/')) {
            // Response to attributes request - contains shared/client attributes
            const sharedData = data.shared || data;
            if (sharedData.temperature !== undefined || sharedData.humidity !== undefined) {
              this.updateDeviceTelemetry(accessToken, sharedData);
            }
          } else if (topic === 'v1/devices/me/attributes') {
            // Attribute update push from server
            if (data.temperature !== undefined || data.humidity !== undefined) {
              this.updateDeviceTelemetry(accessToken, data);
            }
          } else if (topic.startsWith('v1/devices/me/rpc/request/')) {
            // RPC request from server - handle control commands
            console.log('📥 RPC request received:', data);
            // Could handle RPC here if needed
          }
          
          // Broadcast to WebSocket clients if we have sensor data
          if (this.wsService && (data.temperature !== undefined || data.humidity !== undefined)) {
            this.wsService.broadcastSensorData(data);
          }
        } catch (err) {
          console.error('MQTT message parse error:', err);
        }
      });

      this.mqttClient.on('error', (err) => {
        console.error('MQTT error:', err.message);
      });

      this.mqttClient.on('close', () => {
        console.log('MQTT connection closed, will reconnect...');
      });

      this.mqttClient.on('reconnect', () => {
        console.log('MQTT reconnecting...');
      });

    } catch (error) {
      console.error('MQTT connection error:', error.message);
    }
  }

  // Publish telemetry via MQTT
  publishTelemetry(data) {
    if (this.mqttClient && this.mqttClient.connected) {
      this.mqttClient.publish('v1/devices/me/telemetry', JSON.stringify(data));
      console.log('📤 Published telemetry via MQTT:', data);
      return true;
    }
    return false;
  }

  // Get latest telemetry - requires accessToken parameter now
  async getLatestTelemetry(accessToken) {
    if (!accessToken) {
      console.log('⚠️ No access token provided for getLatestTelemetry');
      return null;
    }
    // Use getDeviceTelemetry with provided access token
    return this.getDeviceTelemetry(accessToken);
  }

  // Update telemetry for a specific device (by access token)
  updateDeviceTelemetry(accessToken, data) {
    const existing = this.deviceTelemetryCache.get(accessToken) || {};
    
    const updated = {
      temperature: data.temperature ?? existing.temperature,
      humidity: data.humidity ?? existing.humidity,
      light: data.light ?? existing.light,
      soil_moisture: data.soil_moisture ?? existing.soil_moisture,
      wind: data.wind ?? existing.wind,
      timestamp: new Date().toISOString()
    };
    
    this.deviceTelemetryCache.set(accessToken, updated);
    console.log('Device telemetry updated for token:', accessToken.substring(0, 8) + '...', updated);
  }

  // Extract value from ThingsBoard response format
  extractValue(data, key) {
    if (!data) return null;
    
    // ThingsBoard returns data in format: { key: [{ ts: timestamp, value: value }] }
    if (data[key]) {
      if (Array.isArray(data[key])) {
        return data[key][0]?.value || data[key][0];
      }
      return data[key];
    }
    return null;
  }

  // Send telemetry data to ThingsBoard
  async sendTelemetry(data) {
    try {
      const url = `${this.baseUrl}/api/v1/${this.accessToken}/telemetry`;
      
      await axios.post(url, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });

      return true;
    } catch (error) {
      console.error('ThingsBoard send error:', error.message);
      return false;
    }
  }

  // Send attributes to ThingsBoard
  async sendAttributes(data) {
    try {
      const url = `${this.baseUrl}/api/v1/${this.accessToken}/attributes`;
      
      await axios.post(url, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });

      return true;
    } catch (error) {
      console.error('ThingsBoard attributes error:', error.message);
      return false;
    }
  }

  // Get telemetry history
  async getTelemetryHistory(keys = 'temperature,humidity', startTs, endTs) {
    try {
      // Note: This endpoint requires JWT authentication, not device token
      // For device token, we can only get latest values
      console.log('History request - ThingsBoard device API only supports latest telemetry');
      
      return null;
    } catch (error) {
      console.error('ThingsBoard history error:', error.message);
      return null;
    }
  }

  // Provision a new device on ThingsBoard
  async provisionDevice(deviceName) {
    try {
      const provisionUrl = `${this.baseUrl}/api/v1/provision`;
      
      const provisionRequest = {
        deviceName: deviceName,
        provisionDeviceKey: THINGSBOARD_CONFIG.provisionDeviceKey,
        provisionDeviceSecret: THINGSBOARD_CONFIG.provisionDeviceSecret
      };

      console.log('Provisioning device on ThingsBoard:', deviceName);
      
      const response = await axios.post(provisionUrl, provisionRequest, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      if (response.data && response.data.credentialsValue) {
        const accessToken = response.data.credentialsValue;
        console.log('✅ Device provisioned successfully:', deviceName);
        
        // Get ThingsBoard device ID using JWT API
        let tbDeviceId = null;
        try {
          const token = await this.getJwtToken();
          if (token) {
            // Search for device by name
            const searchUrl = `${this.baseUrl}/api/tenant/devices?pageSize=100&page=0&textSearch=${encodeURIComponent(deviceName)}`;
            const searchRes = await axios.get(searchUrl, {
              headers: { 'X-Authorization': `Bearer ${token}` },
              timeout: 10000
            });
            
            const devices = searchRes.data?.data || [];
            const foundDevice = devices.find(d => d.name === deviceName);
            if (foundDevice) {
              tbDeviceId = foundDevice.id.id;
              console.log('✅ Got ThingsBoard device ID:', tbDeviceId);
            }
          }
        } catch (e) {
          console.error('Could not get ThingsBoard device ID:', e.message);
        }
        
        return {
          success: true,
          accessToken: accessToken,
          deviceId: tbDeviceId,
          provisionKey: THINGSBOARD_CONFIG.provisionDeviceKey,
          provisionSecret: THINGSBOARD_CONFIG.provisionDeviceSecret
        };
      } else {
        console.error('Provision response missing credentials:', response.data);
        return { success: false, error: 'Missing credentials in response' };
      }
    } catch (error) {
      console.error('ThingsBoard provision error:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message 
      };
    }
  }

  // Get telemetry for a specific device by its access token (and optionally device ID)
  async getDeviceTelemetry(accessToken, tbDeviceId = null, retryCount = 0) {
    const MAX_RETRIES = 2;
    
    try {
      // Use provided device ID or try to find it
      let deviceId = tbDeviceId;
      if (!deviceId) {
        deviceId = await this.getDeviceIdByToken(accessToken);
      }
      const token = await this.getJwtToken();
      
      console.log(`📡 Using ThingsBoard device ID: ${deviceId}`);
      
      if (deviceId && token) {
        const keys = 'temperature,humidity,light,soil_moisture,wind';
        const endTs = Date.now();
        const startTs = endTs - 60000; // Last 1 minute
        
        const telemetryUrl = `${this.baseUrl}/api/plugins/telemetry/DEVICE/${deviceId}/values/timeseries?keys=${keys}&startTs=${startTs}&endTs=${endTs}`;
        
        console.log(`📡 [JWT API] Fetching telemetry from ThingsBoard...`);
        
        const response = await axios.get(telemetryUrl, {
          headers: { 'X-Authorization': `Bearer ${token}` },
          timeout: 30000
        });
        
        console.log('📡 Telemetry response keys:', Object.keys(response.data || {}));
        
        const data = response.data || {};
        const hasData = data.temperature?.length > 0 ||
                        data.humidity?.length > 0 ||
                        data.light?.length > 0;

        if (hasData) {
          console.log('📡 Got data from ThingsBoard JWT API');
          return {
            temperature: parseFloat(data.temperature?.[0]?.value),
            humidity: parseFloat(data.humidity?.[0]?.value),
            light: parseFloat(data.light?.[0]?.value),
            soil_moisture: parseFloat(data.soil_moisture?.[0]?.value),
            wind: parseFloat(data.wind?.[0]?.value),
            timestamp: new Date(data.temperature?.[0]?.ts || Date.now()).toISOString(),
            source: 'thingsboard-jwt'
          };
        }
      }

      console.log('📡 No telemetry data available');
      return null;
    } catch (error) {
      console.error(`Get device telemetry error (attempt ${retryCount + 1}):`, error.message);
      console.error('Error details:', error.code, error.response?.status, error.response?.data);
      
      // Retry on timeout or network errors
      if (retryCount < MAX_RETRIES && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND')) {
        console.log(`📡 Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.getDeviceTelemetry(accessToken, retryCount + 1);
      }
      
      return null;
    }
  }

  // Send telemetry for a specific device
  async sendDeviceTelemetry(accessToken, data) {
    try {
      const url = `${this.baseUrl}/api/v1/${accessToken}/telemetry`;
      
      await axios.post(url, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });

      return true;
    } catch (error) {
      console.error('Send device telemetry error:', error.message);
      return false;
    }
  }

  // Send RPC command to device (for control actions)
  async sendRpcCommand(accessToken, method, params = {}) {
    try {
      // ThingsBoard Server-side RPC via device access token
      // The device needs to subscribe to: v1/devices/me/rpc/request/+
      const url = `${this.baseUrl}/api/v1/${accessToken}/rpc`;
      
      const rpcRequest = {
        method: method,
        params: params
      };

      console.log(`📤 Sending RPC command to device: ${method}`, params);
      
      const response = await axios.post(url, rpcRequest, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      console.log('✅ RPC command sent successfully:', response.data);
      return { success: true, response: response.data };
    } catch (error) {
      console.error('RPC command error:', error.response?.data || error.message);
      
      // If HTTP RPC fails, try MQTT
      return this.sendRpcViaMqtt(accessToken, method, params);
    }
  }

  // Send RPC via MQTT (alternative method)
  sendRpcViaMqtt(accessToken, method, params = {}) {
    try {
      if (!this.mqttClient || !this.mqttClient.connected) {
        console.error('MQTT not connected for RPC');
        return { success: false, error: 'MQTT not connected' };
      }

      const requestId = Date.now();
      const rpcTopic = `v1/devices/me/rpc/request/${requestId}`;
      const rpcPayload = JSON.stringify({
        method: method,
        params: params
      });

      this.mqttClient.publish(rpcTopic, rpcPayload);
      console.log(`📤 RPC sent via MQTT: ${method}`, params);
      
      return { success: true, method: 'mqtt', requestId };
    } catch (error) {
      console.error('MQTT RPC error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Control device (high-level function)
  async controlDevice(accessToken, controlType, action, intensity = 100) {
    // Map control types to RPC methods
    const methodMap = {
      'light': 'setLight',
      'fan': 'setFan',
      'pump': 'setPump',
      'watering': 'setWatering',
      'heater': 'setHeater',
      'cooler': 'setCooler',
      'mist': 'setMist'
    };

    const method = methodMap[controlType] || `set${controlType.charAt(0).toUpperCase() + controlType.slice(1)}`;
    
    const stateValue = action === 'on' ? true : (action === 'off' ? false : action);
    
    const params = {
      state: stateValue,
      intensity: intensity,
      timestamp: Date.now()
    };

    // Send RPC command
    const result = await this.sendRpcCommand(accessToken, method, params);
    
    // ALWAYS save attributes to persist state (regardless of RPC success)
    // This ensures we can read back the state later
    const attributeData = {
      [`${controlType}_state`]: stateValue,
      [`${controlType}_intensity`]: intensity,
      [`${controlType}_lastUpdate`]: new Date().toISOString()
    };
    
    console.log('📝 Saving control state to attributes:', attributeData);
    const attrResult = await this.sendDeviceAttributes(accessToken, attributeData);
    console.log('📝 Attributes save result:', attrResult);

    return { ...result, attributesSaved: attrResult };
  }

  // Send attributes to a specific device
  async sendDeviceAttributes(accessToken, data) {
    try {
      const url = `${this.baseUrl}/api/v1/${accessToken}/attributes`;
      
      await axios.post(url, data, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });

      return true;
    } catch (error) {
      console.error('Send device attributes error:', error.message);
      return false;
    }
  }

  // Get control states from device attributes
  async getDeviceControlStates(accessToken, retryCount = 0) {
    const MAX_RETRIES = 2;
    
    try {
      const controlKeys = [
        'light_state', 'light_intensity',
        'fan_state', 'fan_intensity',
        'pump_state', 'pump_intensity',
        'watering_state', 'watering_intensity',
        'heater_state', 'heater_intensity',
        'cooler_state', 'cooler_intensity',
        'mist_state', 'mist_intensity'
      ];

      // Read CLIENT attributes (sent by device/backend via POST /attributes)
      // NOT shared attributes (which are set from ThingsBoard UI)
      const url = `${this.baseUrl}/api/v1/${accessToken}/attributes?clientKeys=${controlKeys.join(',')}`;
      
      console.log(`📖 [Attempt ${retryCount + 1}] Reading control states from:`, url);
      const response = await axios.get(url, { timeout: 30000 });
      console.log('📖 Raw response:', JSON.stringify(response.data));
      
      // Client attributes are in response.data.client
      const data = response.data?.client || response.data || {};
      console.log('📖 Parsed data:', data);

      // Parse control states
      const controls = {
        light: { enabled: data.light_state || false, intensity: data.light_intensity || 100 },
        fan: { enabled: data.fan_state || false, intensity: data.fan_intensity || 100 },
        pump: { enabled: data.pump_state || false, intensity: data.pump_intensity || 100 },
        watering: { enabled: data.watering_state || false, intensity: data.watering_intensity || 100 },
        heater: { enabled: data.heater_state || false, intensity: data.heater_intensity || 100 },
        cooler: { enabled: data.cooler_state || false, intensity: data.cooler_intensity || 100 },
        mist: { enabled: data.mist_state || false, intensity: data.mist_intensity || 100 }
      };

      return controls;
    } catch (error) {
      console.error(`Get device control states error (attempt ${retryCount + 1}):`, error.message);
      
      // Retry on timeout or network errors
      if (retryCount < MAX_RETRIES && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND')) {
        console.log(`📖 Retrying... (${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.getDeviceControlStates(accessToken, retryCount + 1);
      }
      
      return null;
    }
  }

  // Delete device from ThingsBoard
  async deleteDevice(tbDeviceId) {
    try {
      if (!tbDeviceId) {
        console.log('⚠️ No ThingsBoard device ID provided for deletion');
        return { success: false, error: 'No device ID' };
      }

      const token = await this.getJwtToken();
      if (!token) {
        return { success: false, error: 'Could not get JWT token' };
      }

      const url = `${this.baseUrl}/api/device/${tbDeviceId}`;
      console.log(`🗑️ Deleting device from ThingsBoard: ${tbDeviceId}`);
      
      await axios.delete(url, {
        headers: { 'X-Authorization': `Bearer ${token}` },
        timeout: 10000
      });

      console.log('✅ Device deleted from ThingsBoard');
      return { success: true };
    } catch (error) {
      console.error('Delete device from ThingsBoard error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }
}

// Singleton instance
const thingsBoardService = new ThingsBoardService();

module.exports = thingsBoardService;
