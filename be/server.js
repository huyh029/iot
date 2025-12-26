const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const cron = require('node-cron');

// Services
const WebSocketService = require('./services/websocket');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Initialize WebSocket service
const wsService = new WebSocketService(io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static('uploads'));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_garden')
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Socket.io connection handling
io.on('connection', (socket) => {
  wsService.handleConnection(socket);
});

// Make services available to routes
app.set('io', io);
app.set('wsService', wsService);

// Connect MQTT service to WebSocket
const mqttService = require('./services/mqttService');
mqttService.setWsService(wsService);
app.set('mqttService', mqttService);

// Note: Removed default telemetry polling cron job
// Telemetry is now fetched per-device when ESP32 calls /api/devices/controls/:deviceId
// or when frontend requests sensor data

// Scheduled tasks for automated controls
cron.schedule('* * * * *', () => {
  // Check and execute scheduled controls every minute
  const now = new Date();
  console.log(`⏰ Cron: Running scheduler check at ${now.toISOString()} (UTC) / ${now.toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'})} (VN)`);
  require('./services/scheduler').checkScheduledControls(wsService);
});

cron.schedule('*/5 * * * *', () => {
  // Update plant growth progress every 5 minutes
  require('./services/plantService').updateGrowthProgress(wsService);
});

// Check device offline status every 15 seconds
const Device = require('./models/Device');
const User = require('./models/User');
const emailService = require('./services/emailService');
const OFFLINE_TIMEOUT = 15 * 1000; // 15 giây không gọi API thì offline

// Use setInterval for more frequent checks (every 15 seconds)
setInterval(async () => {
  try {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - OFFLINE_TIMEOUT);
    
    // Log để debug
    console.log(`🔍 Checking offline devices... (cutoff: ${cutoffTime.toISOString()})`);
    
    // Find devices that will be marked offline
    const devicesToMarkOffline = await Device.find({
      status: 'online',
      lastSeen: { $lt: cutoffTime }
    }).populate('assignedUsers', '_id email').populate('ownerId', '_id email');
    
    console.log(`🔍 Found ${devicesToMarkOffline.length} device(s) to mark offline`);
    
    if (devicesToMarkOffline.length > 0) {
      // Update status
      await Device.updateMany(
        { _id: { $in: devicesToMarkOffline.map(d => d._id) } },
        { status: 'offline' }
      );
      
      console.log(`📴 ${devicesToMarkOffline.length} device(s) marked offline`);
      
      // Broadcast notifications and send emails
      for (const device of devicesToMarkOffline) {
        console.log(`📴 Processing offline device: ${device.name} (${device.deviceId})`);
        console.log(`📴 Owner data:`, device.ownerId);
        
        // Broadcast status change via WebSocket
        wsService.broadcastDeviceStatus(device._id.toString(), 'offline');
        
        // Get owner email - handle both populated and non-populated cases
        let ownerEmail = null;
        if (device.ownerId) {
          if (typeof device.ownerId === 'object' && device.ownerId.email) {
            ownerEmail = device.ownerId.email;
          } else {
            // If not populated, fetch owner manually
            const owner = await User.findById(device.ownerId).select('email');
            ownerEmail = owner?.email;
          }
        }
        
        console.log(`📴 Owner email: ${ownerEmail}`);
        
        // Notify owner via WebSocket
        const ownerId = device.ownerId?._id || device.ownerId;
        if (ownerId) {
          wsService.sendNotificationToUser(ownerId.toString(), {
            type: 'device_offline',
            message: `Thiết bị "${device.name}" đã offline`,
            severity: 'warning',
            deviceId: device._id
          });
        }
        
        // Send email to owner
        if (ownerEmail) {
          try {
            const result = await emailService.sendDeviceOfflineAlert(ownerEmail, {
              deviceName: device.name,
              deviceId: device.deviceId,
              lastSeen: device.lastSeen
            });
            console.log(`📧 Offline alert email to owner ${ownerEmail}: ${result ? 'SUCCESS' : 'FAILED'}`);
          } catch (emailErr) {
            console.error(`📧 Email error to owner:`, emailErr.message);
          }
        } else {
          console.log(`📧 No owner email found for device ${device.name}`);
        }
        
        // Notify assigned users
        if (device.assignedUsers && device.assignedUsers.length > 0) {
          for (const user of device.assignedUsers) {
            const userId = user._id || user;
            wsService.sendNotificationToUser(userId.toString(), {
              type: 'device_offline',
              message: `Thiết bị "${device.name}" đã offline`,
              severity: 'warning',
              deviceId: device._id
            });
            
            // Send email to assigned users
            const userEmail = user.email;
            if (userEmail) {
              try {
                const result = await emailService.sendDeviceOfflineAlert(userEmail, {
                  deviceName: device.name,
                  deviceId: device.deviceId,
                  lastSeen: device.lastSeen
                });
                console.log(`📧 Offline alert email to user ${userEmail}: ${result ? 'SUCCESS' : 'FAILED'}`);
              } catch (emailErr) {
                console.error(`📧 Email error to user:`, emailErr.message);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Offline check error:', error.message);
  }
}, 15000); // Check every 15 seconds

// Note: Threshold check và email alerts được tích hợp trong API /api/controls/esp/:deviceId
// Khi ESP32 gọi API, hệ thống sẽ check automation rules và gửi email nếu cần

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/sensors', require('./routes/sensors'));
app.use('/api/plants', require('./routes/plants'));
app.use('/api/controls', require('./routes/controls'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/weather', require('./routes/weather'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/garden', require('./routes/garden'));
app.use('/api/camera', require('./routes/camera'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io };