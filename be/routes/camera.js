const express = require('express');
const router = express.Router();

// Store latest frame per device (in-memory cache)
const deviceFrames = new Map();

// Receive frame from ESP32-CAM simulator
router.post('/frame', (req, res) => {
  try {
    const { deviceId, frame, timestamp, width, height } = req.body;
    
    if (!deviceId || !frame) {
      return res.status(400).json({ message: 'Missing deviceId or frame' });
    }
    
    // Store frame in memory
    deviceFrames.set(deviceId, {
      frame,
      timestamp: timestamp || new Date().toISOString(),
      width: width || 640,
      height: height || 480,
      receivedAt: Date.now()
    });
    
    console.log(`📷 Received frame from ${deviceId} (${width}x${height})`);
    
    // Broadcast to WebSocket clients watching this device
    const wsService = req.app.get('wsService');
    if (wsService) {
      wsService.broadcastCameraFrame(deviceId, {
        frame,
        timestamp,
        width,
        height
      });
    }
    
    res.json({ success: true, message: 'Frame received' });
  } catch (error) {
    console.error('Camera frame error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get latest frame for a device
router.get('/frame/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const frameData = deviceFrames.get(deviceId);
    
    if (!frameData) {
      return res.json({ 
        available: false, 
        message: 'Chưa có frame nào từ thiết bị này. Hãy chạy ESP32-CAM simulator và nhập đúng Device ID.',
        deviceId 
      });
    }
    
    // Check if frame is too old (> 10 seconds)
    if (Date.now() - frameData.receivedAt > 10000) {
      return res.json({ 
        available: false, 
        message: 'Frame đã hết hạn (>10s). Simulator có đang gửi không?',
        deviceId,
        lastReceived: new Date(frameData.receivedAt).toISOString()
      });
    }
    
    res.json({
      available: true,
      deviceId,
      frame: frameData.frame,
      timestamp: frameData.timestamp,
      width: frameData.width,
      height: frameData.height
    });
  } catch (error) {
    console.error('Get frame error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get frame as image (for direct embedding in img tag)
router.get('/stream/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const frameData = deviceFrames.get(deviceId);
    
    if (!frameData || Date.now() - frameData.receivedAt > 10000) {
      // Return placeholder image
      res.redirect('/api/camera/placeholder');
      return;
    }
    
    // Convert base64 to buffer and send as image
    const imageBuffer = Buffer.from(frameData.frame, 'base64');
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(imageBuffer);
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Placeholder image
router.get('/placeholder', (req, res) => {
  // Simple 1x1 gray pixel
  const pixel = Buffer.from('R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
  res.set('Content-Type', 'image/gif');
  res.send(pixel);
});

// List all active camera streams
router.get('/active', (req, res) => {
  const activeDevices = [];
  const now = Date.now();
  
  deviceFrames.forEach((data, deviceId) => {
    if (now - data.receivedAt < 10000) {
      activeDevices.push({
        deviceId,
        timestamp: data.timestamp,
        width: data.width,
        height: data.height,
        age: now - data.receivedAt
      });
    }
  });
  
  res.json({ devices: activeDevices });
});

module.exports = router;
