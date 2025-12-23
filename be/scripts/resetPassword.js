const mongoose = require('mongoose');
require('dotenv').config();

async function resetPassword() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('../models/User');
  
  const username = process.argv[2] || 'huyh0';
  const newPassword = process.argv[3] || 'manager123';
  
  const user = await User.findOne({ username });
  if (!user) {
    console.log(`User ${username} not found`);
    process.exit(1);
  }
  
  user.password = newPassword;
  await user.save();
  
  console.log(`✅ Password reset for ${username}`);
  console.log(`   New password: ${newPassword}`);
  
  await mongoose.disconnect();
}

resetPassword();
