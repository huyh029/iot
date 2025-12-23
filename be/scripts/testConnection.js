const mongoose = require('mongoose');
require('dotenv').config();

async function testConnection() {
  try {
    console.log('🔄 Testing MongoDB connection...');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://huyh01480_db_user:rlzyd6O8yvsllJac@cluster0.wi7d1el.mongodb.net/smart_garden');
    
    console.log('✅ MongoDB connection successful!');
    console.log('📊 Database:', mongoose.connection.db.databaseName);
    console.log('🌐 Host:', mongoose.connection.host);
    
    // Test collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📁 Collections:', collections.map(c => c.name).join(', '));
    
    // Count documents
    const User = require('../models/User');
    const Device = require('../models/Device');
    const Plant = require('../models/Plant');
    
    const userCount = await User.countDocuments();
    const deviceCount = await Device.countDocuments();
    const plantCount = await Plant.countDocuments();
    
    console.log('👥 Users:', userCount);
    console.log('📱 Devices:', deviceCount);
    console.log('🌱 Plants:', plantCount);
    
    if (userCount === 0) {
      console.log('\n⚠️  No data found. Run "npm run seed" to create sample data.');
    }
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

testConnection();