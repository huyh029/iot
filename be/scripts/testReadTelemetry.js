const axios = require('axios');
require('dotenv').config();

const TB_HOST = process.env.THINGSBOARD_HOST || 'https://thingsboard.cloud';
const TB_USER = process.env.THINGSBOARD_USERNAME;
const TB_PASS = process.env.THINGSBOARD_PASSWORD;
const DEVICE_ID = 'f8a53610-df2b-11f0-bcba-9f87c351edd8'; // SG device

async function readTelemetry() {
  try {
    // Login
    console.log('Logging in...');
    const loginRes = await axios.post(`${TB_HOST}/api/auth/login`, {
      username: TB_USER,
      password: TB_PASS
    });
    const token = loginRes.data.token;
    console.log('✅ Login successful\n');

    // Read telemetry
    const keys = 'temperature,humidity,light,soil_moisture,wind';
    const endTs = Date.now();
    const startTs = endTs - 300000; // Last 5 minutes

    const url = `${TB_HOST}/api/plugins/telemetry/DEVICE/${DEVICE_ID}/values/timeseries?keys=${keys}&startTs=${startTs}&endTs=${endTs}`;
    console.log('Fetching telemetry...');
    
    const response = await axios.get(url, {
      headers: { 'X-Authorization': `Bearer ${token}` }
    });

    console.log('\n📊 Telemetry data:');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

readTelemetry();
