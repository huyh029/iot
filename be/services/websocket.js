class WebSocketService {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> socketId
    this.userRooms = new Map(); // socketId -> userId
  }

  // User connection management
  handleConnection(socket) {
    console.log('New WebSocket connection:', socket.id);

    // Join user to their room
    socket.on('join-user-room', (userId) => {
      socket.join(`user_${userId}`);
      this.connectedUsers.set(userId, socket.id);
      this.userRooms.set(socket.id, userId);
      console.log(`User ${userId} joined room user_${userId}`);
    });

    // Join device room for real-time device data
    socket.on('join-device-room', (deviceId) => {
      socket.join(`device_${deviceId}`);
      console.log(`Socket ${socket.id} joined device room: device_${deviceId}`);
    });

    // Receive camera frame from simulator via WebSocket
    socket.on('camera-frame-upload', (data) => {
      const { deviceId, frame, timestamp, width, height } = data;
      if (deviceId && frame) {
        // Broadcast to all clients watching cameras
        this.broadcastCameraFrame(deviceId, { frame, timestamp, width, height });
      }
    });

    // WebRTC Signaling
    socket.on('webrtc-register', (data) => {
      const { deviceId, role } = data;
      socket.join(`webrtc_${deviceId}`);
      socket.webrtcRole = role;
      socket.webrtcDeviceId = deviceId;
      console.log(`🎥 WebRTC ${role} registered for device ${deviceId}`);
      
      // If broadcaster, store socket id
      if (role === 'broadcaster') {
        this.webrtcBroadcasters = this.webrtcBroadcasters || new Map();
        this.webrtcBroadcasters.set(deviceId, socket.id);
      }
    });

    socket.on('webrtc-start-broadcast', (data) => {
      const { deviceId } = data;
      console.log(`🎥 WebRTC broadcast started for ${deviceId}`);
      // Store that this device is broadcasting
      this.webrtcBroadcasting = this.webrtcBroadcasting || new Set();
      this.webrtcBroadcasting.add(deviceId);
      this.io.to(`webrtc_${deviceId}`).emit('webrtc-broadcast-started', { deviceId });
    });

    socket.on('webrtc-join-stream', (data) => {
      const { deviceId, viewerId } = data;
      socket.join(`webrtc_${deviceId}`);
      console.log(`🎥 Viewer ${viewerId || socket.id} joined stream ${deviceId}`);
      
      // Notify ONLY the broadcaster that a viewer joined (not all sockets in room)
      const broadcasterId = this.webrtcBroadcasters?.get(deviceId);
      if (broadcasterId) {
        this.io.to(broadcasterId).emit('webrtc-viewer-joined', { 
          deviceId, 
          viewerId: socket.id 
        });
        console.log(`🎥 Notified broadcaster ${broadcasterId} about viewer ${socket.id}`);
      } else {
        console.log(`🎥 No broadcaster found for device ${deviceId}`);
      }
    });

    socket.on('webrtc-offer', (data) => {
      const { deviceId, viewerId, offer } = data;
      console.log(`🎥 Offer from broadcaster to viewer ${viewerId} for device ${deviceId}`);
      // Send offer directly to the viewer
      this.io.to(viewerId).emit('webrtc-offer', { deviceId, offer });
      console.log(`🎥 Offer sent to viewer ${viewerId}`);
    });

    socket.on('webrtc-answer', (data) => {
      const { deviceId, answer } = data;
      console.log(`🎥 Answer from viewer ${socket.id} for ${deviceId}`);
      // Send answer to broadcaster
      const broadcasterId = this.webrtcBroadcasters?.get(deviceId);
      console.log(`🎥 Looking for broadcaster for ${deviceId}, found: ${broadcasterId}`);
      if (broadcasterId) {
        this.io.to(broadcasterId).emit('webrtc-answer', { deviceId, answer, viewerId: socket.id });
        console.log(`🎥 Answer forwarded to broadcaster ${broadcasterId}`);
      } else {
        console.log(`🎥 ERROR: No broadcaster found for device ${deviceId}!`);
      }
    });

    socket.on('webrtc-ice-candidate', (data) => {
      const { deviceId, viewerId, candidate } = data;
      // Forward ICE candidate to the other peer
      if (viewerId) {
        // From broadcaster to viewer
        this.io.to(viewerId).emit('webrtc-ice-candidate', { deviceId, candidate });
      } else {
        // From viewer to broadcaster
        const broadcasterId = this.webrtcBroadcasters?.get(deviceId);
        if (broadcasterId) {
          this.io.to(broadcasterId).emit('webrtc-ice-candidate', { deviceId, candidate });
        }
      }
    });

    socket.on('webrtc-stop-broadcast', (data) => {
      const { deviceId } = data;
      this.webrtcBroadcasting?.delete(deviceId);
      this.webrtcBroadcasters?.delete(deviceId);
      this.io.to(`webrtc_${deviceId}`).emit('webrtc-broadcast-stopped', { deviceId });
    });

    // Handle control commands
    socket.on('device-control', (data) => {
      this.handleDeviceControl(socket, data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const userId = this.userRooms.get(socket.id);
      if (userId) {
        this.connectedUsers.delete(userId);
        this.userRooms.delete(socket.id);
      }
      console.log('WebSocket disconnected:', socket.id);
    });
  }

  // Send real-time sensor data to connected clients
  broadcastSensorData(deviceId, sensorData) {
    // If deviceId is an object (telemetry data), broadcast to all
    if (typeof deviceId === 'object') {
      this.io.emit('thingsboard-telemetry', {
        data: deviceId,
        timestamp: new Date()
      });
      return;
    }
    
    this.io.to(`device_${deviceId}`).emit('sensor-data', {
      deviceId,
      data: sensorData,
      timestamp: new Date()
    });
  }

  // Broadcast ThingsBoard telemetry to all clients
  broadcastThingsBoardData(telemetryData) {
    this.io.emit('thingsboard-telemetry', {
      data: telemetryData,
      timestamp: new Date()
    });
  }

  // Send device status updates
  broadcastDeviceStatus(deviceId, status) {
    this.io.to(`device_${deviceId}`).emit('device-status', {
      deviceId,
      status,
      timestamp: new Date()
    });
  }

  // Send control state updates
  broadcastControlUpdate(deviceId, controlData) {
    this.io.to(`device_${deviceId}`).emit('control-update', {
      deviceId,
      control: controlData,
      timestamp: new Date()
    });
  }

  // Send control command to device
  broadcastToDevice(deviceId, eventType, data) {
    this.io.to(`device_${deviceId}`).emit(eventType, {
      deviceId,
      ...data,
      timestamp: new Date()
    });
  }

  // Send notifications to specific user
  sendNotificationToUser(userId, notification) {
    this.io.to(`user_${userId}`).emit('notification', {
      ...notification,
      timestamp: new Date()
    });
  }

  // Send plant growth updates
  broadcastPlantUpdate(deviceId, plantData) {
    this.io.to(`device_${deviceId}`).emit('plant-update', {
      deviceId,
      plant: plantData,
      timestamp: new Date()
    });
  }

  // Send weather updates
  broadcastWeatherUpdate(location, weatherData) {
    this.io.emit('weather-update', {
      location,
      weather: weatherData,
      timestamp: new Date()
    });
  }

  // Handle device control commands from clients
  async handleDeviceControl(socket, data) {
    try {
      const { deviceId, controlType, action, settings } = data;
      
      // Validate user permissions here
      const userId = this.userRooms.get(socket.id);
      if (!userId) {
        socket.emit('control-error', { message: 'User not authenticated' });
        return;
      }

      // Emit control command to device
      this.io.to(`device_${deviceId}`).emit('control-command', {
        deviceId,
        controlType,
        action,
        settings,
        userId,
        timestamp: new Date()
      });

      // Acknowledge command received
      socket.emit('control-acknowledged', {
        deviceId,
        controlType,
        action,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error handling device control:', error);
      socket.emit('control-error', { message: 'Failed to process control command' });
    }
  }

  // Send dashboard data updates
  broadcastDashboardUpdate(userId, dashboardData) {
    this.io.to(`user_${userId}`).emit('dashboard-update', {
      data: dashboardData,
      timestamp: new Date()
    });
  }

  // Send system alerts
  broadcastSystemAlert(alert) {
    this.io.emit('system-alert', {
      ...alert,
      timestamp: new Date()
    });
  }

  // Send user management updates (for superadmin/manager)
  broadcastUserUpdate(managerId, userData) {
    this.io.to(`user_${managerId}`).emit('user-update', {
      user: userData,
      timestamp: new Date()
    });
  }

  // Send device management updates
  broadcastDeviceUpdate(ownerId, deviceData) {
    this.io.to(`user_${ownerId}`).emit('device-management-update', {
      device: deviceData,
      timestamp: new Date()
    });
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  // Send real-time camera feed updates
  broadcastCameraFeed(deviceId, frameData) {
    this.io.to(`device_${deviceId}`).emit('camera-feed', {
      deviceId,
      frame: frameData,
      timestamp: new Date()
    });
  }

  // Broadcast camera frame to all clients watching this device
  broadcastCameraFrame(deviceId, frameData) {
    this.io.to(`camera_${deviceId}`).emit('camera-frame', {
      deviceId,
      ...frameData,
      timestamp: new Date()
    });
    // Also emit to general camera channel
    this.io.emit('camera-frame', {
      deviceId,
      ...frameData,
      timestamp: new Date()
    });
  }

  // Send garden map updates
  broadcastGardenMapUpdate(deviceId, mapData) {
    this.io.to(`device_${deviceId}`).emit('garden-map-update', {
      deviceId,
      map: mapData,
      timestamp: new Date()
    });
  }
}

module.exports = WebSocketService;