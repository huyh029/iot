const mongoose = require('mongoose');
const User = require('../models/User');
const Device = require('../models/Device');
const Plant = require('../models/Plant');
const SensorData = require('../models/SensorData');
require('dotenv').config();

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://huyh01480_db_user:rlzyd6O8yvsllJac@cluster0.wi7d1el.mongodb.net/smart_garden');
    console.log('Connected to MongoDB');

    // Clear existing data (optional)
    const clearData = process.argv.includes('--clear');
    if (clearData) {
      await User.deleteMany({});
      await Device.deleteMany({});
      await Plant.deleteMany({});
      await SensorData.deleteMany({});
      console.log('🗑️  Cleared existing data');
    }

    // 1. Create SuperAdmin
    let superAdmin = await User.findOne({ role: 'superadmin' });
    if (!superAdmin) {
      superAdmin = new User({
        username: 'superadmin',
        email: 'superadmin@smartgarden.com',
        password: 'admin123456',
        fullName: 'Super Administrator',
        role: 'superadmin',
        phone: '+84123456789',
        address: 'Smart Garden Headquarters',
        isActive: true
      });
      await superAdmin.save();
      console.log('✅ SuperAdmin created');
    }

    // 2. Create Sample Managers
    const managers = [];
    for (let i = 1; i <= 3; i++) {
      let manager = await User.findOne({ username: `manager${i}` });
      if (!manager) {
        manager = new User({
          username: `manager${i}`,
          email: `manager${i}@smartgarden.com`,
          password: 'manager123',
          fullName: `Manager ${i}`,
          role: 'manager',
          phone: `+8412345678${i}`,
          address: `Manager ${i} Address`,
          createdBy: superAdmin._id,
          purchaseDate: new Date(),
          isActive: true
        });
        await manager.save();
        managers.push(manager);
        console.log(`✅ Manager ${i} created`);
      } else {
        managers.push(manager);
      }
    }

    // 3. Create Sample Devices for each Manager
    const devices = [];
    for (let i = 0; i < managers.length; i++) {
      const manager = managers[i];
      for (let j = 1; j <= 2; j++) {
        const deviceId = `ESP32_${i + 1}_${j}`;
        let device = await Device.findOne({ deviceId });
        if (!device) {
          device = new Device({
            deviceId,
            name: `Smart Garden Device ${i + 1}-${j}`,
            type: 'esp32',
            location: {
              latitude: 10.762622 + (i * 0.01) + (j * 0.005),
              longitude: 106.660172 + (i * 0.01) + (j * 0.005),
              address: `Garden Location ${i + 1}-${j}, Ho Chi Minh City`
            },
            status: Math.random() > 0.3 ? 'online' : 'offline',
            ownerId: manager._id,
            specifications: {
              model: 'ESP32-DevKitC',
              version: '1.0',
              capabilities: ['temperature', 'humidity', 'light', 'soil_moisture', 'irrigation', 'lighting']
            },
            configuration: {
              mqttTopic: `smartgarden/${deviceId}`,
              updateInterval: 30,
              timezone: 'Asia/Ho_Chi_Minh'
            },
            isActive: true
          });
          await device.save();
          devices.push(device);
          console.log(`✅ Device ${deviceId} created for ${manager.fullName}`);
        } else {
          devices.push(device);
        }
      }
    }

    // 4. Create Sample Users for each Manager
    const users = [];
    for (let i = 0; i < managers.length; i++) {
      const manager = managers[i];
      const managerDevices = devices.filter(d => d.ownerId.toString() === manager._id.toString());
      
      for (let j = 1; j <= 3; j++) {
        const username = `user${i + 1}_${j}`;
        let user = await User.findOne({ username });
        if (!user) {
          user = new User({
            username,
            email: `user${i + 1}_${j}@smartgarden.com`,
            password: 'user123',
            fullName: `User ${i + 1}-${j}`,
            role: 'user',
            phone: `+8412345${i}${j}${j}${j}`,
            address: `User ${i + 1}-${j} Address`,
            createdBy: manager._id,
            managerId: manager._id,
            deviceIds: [managerDevices[j % managerDevices.length]._id], // Assign one device
            purchaseDate: new Date(),
            isActive: true
          });
          await user.save();
          users.push(user);
          console.log(`✅ User ${username} created for ${manager.fullName}`);
        } else {
          users.push(user);
        }
      }
    }

    // 5. Update device assigned users
    for (const device of devices) {
      const assignedUsers = users.filter(u => u.deviceIds.includes(device._id));
      device.assignedUsers = assignedUsers.map(u => u._id);
      await device.save();
    }

    // 6. Create Sample Plants
    const plantTypes = [
      { name: 'Cà chua', type: 'vegetable', variety: 'Cherry Tomato', days: 75 },
      { name: 'Rau xà lách', type: 'vegetable', variety: 'Butter Lettuce', days: 45 },
      { name: 'Ớt', type: 'vegetable', variety: 'Bell Pepper', days: 80 },
      { name: 'Húng quế', type: 'herb', variety: 'Sweet Basil', days: 60 },
      { name: 'Dưa chuột', type: 'vegetable', variety: 'Cucumber', days: 55 }
    ];

    for (const device of devices) {
      const deviceUsers = users.filter(u => u.deviceIds.includes(device._id));
      
      for (let i = 0; i < 3; i++) {
        const plantType = plantTypes[i % plantTypes.length];
        const plantedDaysAgo = Math.floor(Math.random() * plantType.days);
        const plantedDate = new Date(Date.now() - plantedDaysAgo * 24 * 60 * 60 * 1000);
        const expectedHarvestDate = new Date(plantedDate.getTime() + plantType.days * 24 * 60 * 60 * 1000);
        
        const plant = new Plant({
          name: `${plantType.name} ${i + 1}`,
          type: plantType.type,
          variety: plantType.variety,
          deviceId: device._id,
          userId: deviceUsers[i % deviceUsers.length]?._id || device.ownerId,
          plantedDate,
          expectedHarvestDate,
          location: {
            zone: `Zone ${String.fromCharCode(65 + i)}`,
            row: Math.floor(i / 3) + 1,
            column: (i % 3) + 1
          },
          optimalConditions: {
            temperature: { min: 20, max: 30, unit: '°C' },
            humidity: { min: 60, max: 80, unit: '%' },
            light: { min: 1000, max: 3000, unit: 'lux' },
            soilMoisture: { min: 40, max: 70, unit: '%' }
          },
          isActive: true
        });
        
        plant.calculateGrowthProgress();
        await plant.save();
      }
    }
    console.log('✅ Sample plants created');

    // 7. Create Sample Sensor Data
    const sensorTypes = ['temperature', 'humidity', 'light', 'soil_moisture'];
    const now = new Date();
    
    for (const device of devices) {
      if (device.status === 'online') {
        for (let hours = 24; hours >= 0; hours--) {
          const timestamp = new Date(now.getTime() - hours * 60 * 60 * 1000);
          
          for (const sensorType of sensorTypes) {
            let value, unit;
            
            switch (sensorType) {
              case 'temperature':
                value = 20 + Math.random() * 15; // 20-35°C
                unit = '°C';
                break;
              case 'humidity':
                value = 50 + Math.random() * 40; // 50-90%
                unit = '%';
                break;
              case 'light':
                value = Math.random() * 2000; // 0-2000 lux
                unit = 'lux';
                break;
              case 'soil_moisture':
                value = 30 + Math.random() * 50; // 30-80%
                unit = '%';
                break;
            }
            
            const sensorData = new SensorData({
              deviceId: device._id,
              sensorType,
              value: Math.round(value * 100) / 100,
              unit,
              timestamp,
              location: {
                latitude: device.location.latitude,
                longitude: device.location.longitude
              },
              metadata: {
                calibrated: true,
                accuracy: 95 + Math.random() * 5,
                batteryLevel: 80 + Math.random() * 20
              }
            });
            
            await sensorData.save();
          }
        }
      }
    }
    console.log('✅ Sample sensor data created');

    console.log('\n🎉 Database seeded successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('SuperAdmin: superadmin / admin123456');
    console.log('Managers: manager1, manager2, manager3 / manager123');
    console.log('Users: user1_1, user1_2, etc. / user123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
seedDatabase();