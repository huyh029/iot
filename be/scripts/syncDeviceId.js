const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const TB_HOST = process.env.THINGSBOARD_HOST || 'https://thingsboard.cloud';
const TB_USER = process.env.THINGSBOARD_USERNAME;
const TB_PASS = process.env.THINGSBOARD_PASSWORD;

async function syncDevices() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Device = require('../models/Device');

  // Login to ThingsBoard
  const loginRes = await axios.post(`${TB_HOST}/api/auth/login`, {
    username: TB_USER,
    password: TB_PASS
  });
  const token = loginRes.data.token;

  // Get all ThingsBoard devices
  const devicesRes = await axios.get(`${TB_HOST}/api/tenant/devices?pageSize=100&page=0`, {
    headers: { 'X-Authorization': `Bearer ${token}` }
  });

  const tbDevices = devicesRes.data?.data || [];

  // Get credentials for each device
  for (const tbDevice of tbDevices) {
    const credRes = await axios.get(`${TB_HOST}/api/device/${tbDevice.id.id}/credentials`, {
      headers: { 'X-Authorization': `Bearer ${token}` }
    });
    const accessToken = credRes.data.credentialsId;

    // Find matching device in MongoDB by access token
    const mongoDevice = await Device.findOne({ 'thingsboard.accessToken': accessToken });
    
    if (mongoDevice) {
      mongoDevice.thingsboard.deviceId = tbDevice.id.id;
      await mongoDevice.save();
      console.log(`✅ Synced: ${mongoDevice.name} -> TB ID: ${tbDevice.id.id}`);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone!');
}

syncDevices();
