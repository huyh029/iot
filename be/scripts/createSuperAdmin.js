const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

async function createSuperAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://huyh01480_db_user:rlzyd6O8yvsllJac@cluster0.wi7d1el.mongodb.net/smart_garden');
    console.log('Connected to MongoDB');

    // Check if superadmin already exists
    const existingSuperAdmin = await User.findOne({ role: 'superadmin' });
    if (existingSuperAdmin) {
      console.log('SuperAdmin already exists:');
      console.log('Username:', existingSuperAdmin.username);
      console.log('Email:', existingSuperAdmin.email);
      console.log('Full Name:', existingSuperAdmin.fullName);
      return;
    }

    // Create superadmin account
    const superAdminData = {
      username: 'superadmin',
      email: 'superadmin@smartgarden.com',
      password: 'admin123456', // This will be hashed automatically
      fullName: 'Super Administrator',
      role: 'superadmin',
      phone: '+84123456789',
      address: 'Smart Garden Headquarters',
      isActive: true
    };

    const superAdmin = new User(superAdminData);
    await superAdmin.save();

    console.log('✅ SuperAdmin account created successfully!');
    console.log('📧 Email:', superAdmin.email);
    console.log('👤 Username:', superAdmin.username);
    console.log('🔑 Password: admin123456');
    console.log('📱 Phone:', superAdmin.phone);
    console.log('🏠 Address:', superAdmin.address);
    console.log('');
    console.log('⚠️  Please change the default password after first login!');

  } catch (error) {
    console.error('❌ Error creating SuperAdmin:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
createSuperAdmin();