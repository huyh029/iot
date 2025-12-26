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
      // Rau củ
      { name: 'Cà chua', type: 'vegetable', variety: 'Cherry Tomato', days: 75 },
      { name: 'Rau xà lách', type: 'vegetable', variety: 'Butter Lettuce', days: 45 },
      { name: 'Ớt', type: 'vegetable', variety: 'Bell Pepper', days: 80 },
      { name: 'Dưa chuột', type: 'vegetable', variety: 'Cucumber', days: 55 },
      { name: 'Cà rốt', type: 'vegetable', variety: 'Carrot', days: 70 },
      { name: 'Bắp cải', type: 'vegetable', variety: 'Cabbage', days: 90 },
      
      // Thảo mộc
      { name: 'Húng quế', type: 'herb', variety: 'Sweet Basil', days: 60 },
      { name: 'Rau mùi', type: 'herb', variety: 'Coriander', days: 45 },
      { name: 'Bạc hà', type: 'herb', variety: 'Mint', days: 50 },
      
      // Cây ăn quả - Trái cây nhiệt đới
      { name: 'Xoài', type: 'fruit', variety: 'Mango Cat Hoa Loc', days: 120 },
      { name: 'Bưởi', type: 'fruit', variety: 'Pomelo Da Xanh', days: 180 },
      { name: 'Cam', type: 'fruit', variety: 'Orange Sanh', days: 150 },
      { name: 'Chanh', type: 'fruit', variety: 'Lime', days: 90 },
      { name: 'Ổi', type: 'fruit', variety: 'Guava', days: 100 },
      { name: 'Mít', type: 'fruit', variety: 'Jackfruit Thai', days: 150 },
      { name: 'Sầu riêng', type: 'fruit', variety: 'Durian Ri6', days: 180 },
      { name: 'Măng cụt', type: 'fruit', variety: 'Mangosteen', days: 150 },
      { name: 'Chôm chôm', type: 'fruit', variety: 'Rambutan', days: 120 },
      { name: 'Nhãn', type: 'fruit', variety: 'Longan', days: 130 },
      { name: 'Vải', type: 'fruit', variety: 'Lychee', days: 120 },
      { name: 'Thanh long', type: 'fruit', variety: 'Dragon Fruit', days: 100 },
      { name: 'Dừa', type: 'fruit', variety: 'Coconut', days: 365 },
      { name: 'Chuối', type: 'fruit', variety: 'Banana Cavendish', days: 270 },
      { name: 'Đu đủ', type: 'fruit', variety: 'Papaya', days: 180 },
      { name: 'Dưa hấu', type: 'fruit', variety: 'Watermelon', days: 80 },
      { name: 'Dưa lưới', type: 'fruit', variety: 'Cantaloupe', days: 75 },
      { name: 'Táo', type: 'fruit', variety: 'Apple', days: 150 },
      { name: 'Lê', type: 'fruit', variety: 'Pear', days: 140 },
      { name: 'Nho', type: 'fruit', variety: 'Grape', days: 150 },
      { name: 'Dâu tây', type: 'fruit', variety: 'Strawberry', days: 90 },
      { name: 'Bơ', type: 'fruit', variety: 'Avocado', days: 180 },
      { name: 'Mận', type: 'fruit', variety: 'Plum', days: 120 },
      { name: 'Đào', type: 'fruit', variety: 'Peach', days: 130 },
      { name: 'Khế', type: 'fruit', variety: 'Star Fruit', days: 100 },
      { name: 'Sapoche', type: 'fruit', variety: 'Sapodilla', days: 150 },
      { name: 'Mãng cầu', type: 'fruit', variety: 'Soursop', days: 140 },
      { name: 'Vú sữa', type: 'fruit', variety: 'Star Apple', days: 150 },
      { name: 'Quýt', type: 'fruit', variety: 'Tangerine', days: 140 },
      
      // Hoa
      { name: 'Hoa hồng', type: 'flower', variety: 'Rose', days: 60 },
      { name: 'Hoa cúc', type: 'flower', variety: 'Chrysanthemum', days: 75 },
      { name: 'Hoa lan', type: 'flower', variety: 'Orchid', days: 90 }
    ];

    for (const device of devices) {
      const deviceUsers = users.filter(u => u.deviceIds.includes(device._id));
      
      // Tạo 5 cây mẫu cho mỗi thiết bị với các loại khác nhau
      const shuffledPlants = [...plantTypes].sort(() => Math.random() - 0.5);
      const selectedPlants = shuffledPlants.slice(0, 5);
      
      for (let i = 0; i < selectedPlants.length; i++) {
        const plantType = selectedPlants[i];
        const plantedDaysAgo = Math.floor(Math.random() * plantType.days);
        const plantedDate = new Date(Date.now() - plantedDaysAgo * 24 * 60 * 60 * 1000);
        const expectedHarvestDate = new Date(plantedDate.getTime() + plantType.days * 24 * 60 * 60 * 1000);
        
        // Điều kiện tối ưu theo loại cây
        let optimalConditions = {
          temperature: { min: 20, max: 30, unit: '°C' },
          humidity: { min: 60, max: 80, unit: '%' },
          light: { min: 1000, max: 3000, unit: 'lux' },
          soilMoisture: { min: 40, max: 70, unit: '%' }
        };
        
        // Điều chỉnh điều kiện theo loại cây ăn quả
        if (plantType.type === 'fruit') {
          optimalConditions = {
            temperature: { min: 22, max: 35, unit: '°C' },
            humidity: { min: 65, max: 85, unit: '%' },
            light: { min: 2000, max: 5000, unit: 'lux' },
            soilMoisture: { min: 50, max: 75, unit: '%' }
          };
        }
        
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
          optimalConditions,
          isActive: true
        });
        
        plant.calculateGrowthProgress();
        await plant.save();
      }
    }
    console.log('✅ Sample plants created (including fruit trees)');

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