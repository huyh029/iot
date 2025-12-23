const axios = require('axios');
require('dotenv').config();

const TB_HOST = process.env.THINGSBOARD_HOST || 'https://thingsboard.cloud';
const TB_USER = process.env.THINGSBOARD_USERNAME;
const TB_PASS = process.env.THINGSBOARD_PASSWORD;

async function listDevices() {
  try {
    // Login
    console.log('Logging in to ThingsBoard...');
    const loginRes = await axios.post(`${TB_HOST}/api/auth/login`, {
      username: TB_USER,
      password: TB_PASS
    });
    const token = loginRes.data.token;
    console.log('✅ Login successful\n');

    // Get devices
    const devicesRes = await axios.get(`${TB_HOST}/api/tenant/devices?pageSize=100&page=0`, {
      headers: { 'X-Authorization': `Bearer ${token}` }
    });

    const devices = devicesRes.data?.data || [];
    console.log(`Found ${devices.length} devices on ThingsBoard:\n`);

    for (const device of devices) {
      // Get credentials
      const credRes = await axios.get(`${TB_HOST}/api/device/${device.id.id}/credentials`, {
        headers: { 'X-Authorization': `Bearer ${token}` }
      });

      console.log(`- ${device.name}`);
      console.log(`  ID: ${device.id.id}`);
      console.log(`  Access Token: ${credRes.data.credentialsId}`);
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error.response?.data?.message || error.message);
  }
}

listDevices();
