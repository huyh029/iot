const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

async function resetDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Drop all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`Found ${collections.length} collections`);
    
    for (const collection of collections) {
      await mongoose.connection.db.dropCollection(collection.name);
      console.log(`🗑️ Dropped collection: ${collection.name}`);
    }

    // Use the actual User model
    const User = require('../models/User');

    // Create superadmin account (password will be hashed by pre-save hook)
    const superadmin = await User.create({
      username: 'superadmin',
      email: 'superadmin@smartgarden.com',
      password: 'admin123',
      fullName: 'Super Admin',
      role: 'superadmin',
      isActive: true
    });

    console.log('\n✅ Database reset complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('SuperAdmin Account:');
    console.log('  Username: superadmin');
    console.log('  Email: superadmin@smartgarden.com');
    console.log('  Password: admin123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetDatabase();
