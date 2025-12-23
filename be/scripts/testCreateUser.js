const mongoose = require('mongoose');
require('dotenv').config();

async function testCreateUser() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('../models/User');
  
  // Create a test manager
  const testUser = new User({
    username: 'testmanager',
    email: 'test@test.com',
    password: 'test123',
    fullName: 'Test Manager',
    role: 'manager'
  });
  
  await testUser.save();
  console.log('Created user:', testUser.username);
  console.log('Password hash:', testUser.password);
  
  // Test login
  const foundUser = await User.findOne({ username: 'testmanager' });
  const isMatch = await foundUser.comparePassword('test123');
  console.log('Password match test:', isMatch);
  
  // Cleanup
  await User.deleteOne({ username: 'testmanager' });
  console.log('Cleaned up test user');
  
  await mongoose.disconnect();
}

testCreateUser();
