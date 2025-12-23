const mongoose = require('mongoose');
require('dotenv').config();

async function checkUsers() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('../models/User');
  
  const users = await User.find({}).select('username email role isActive password');
  console.log('All users in database:');
  users.forEach(u => {
    console.log(`- ${u.username} (${u.role}) - active: ${u.isActive} - password hash: ${u.password?.substring(0, 20)}...`);
  });
  
  await mongoose.disconnect();
}

checkUsers();
