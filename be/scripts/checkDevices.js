const mongoose = require('mongoose');
require('dotenv').config();

async function checkDevices() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Device = require('../models/Device');
  
  const devices = await Device.find({});
  console.log('All devices in database:');
  devices.forEach(d => {
    console.log(`- ${d.name} (${d._id})`);
    console.log(`  Access Token: ${d.thingsboard?.accessToken || 'N/A'}`);
    console.log(`  ThingsBoard ID: ${d.thingsboard?.deviceId || 'N/A'}`);
  });
  
  await mongoose.disconnect();
}

checkDevices();
