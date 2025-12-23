const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Get user from database to ensure they still exist and are active
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    req.user = decoded;
    req.userDoc = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    next();
  };
};

// Check if user can access specific device
const checkDeviceAccess = async (req, res, next) => {
  try {
    const { deviceId } = req.params;
    const user = req.userDoc;

    // SuperAdmin can access all devices
    if (user.role === 'superadmin') {
      return next();
    }

    // Manager can access devices they own
    if (user.role === 'manager') {
      const Device = require('../models/Device');
      const device = await Device.findById(deviceId);
      
      if (!device) {
        return res.status(404).json({ message: 'Device not found' });
      }

      if (device.ownerId.toString() !== user._id.toString()) {
        return res.status(403).json({ message: 'Access denied to this device' });
      }

      return next();
    }

    // User can access devices assigned to them OR devices owned by their Manager (createdBy)
    if (user.role === 'user') {
      const Device = require('../models/Device');
      const device = await Device.findById(deviceId);
      
      if (!device) {
        return res.status(404).json({ message: 'Device not found' });
      }

      // Check if device is in user's deviceIds
      if (user.deviceIds.includes(deviceId)) {
        return next();
      }

      // Check if device belongs to user's Manager (createdBy)
      if (user.createdBy && device.ownerId.toString() === user.createdBy.toString()) {
        return next();
      }

      return res.status(403).json({ message: 'Access denied to this device' });
    }

    res.status(403).json({ message: 'Access denied' });
  } catch (error) {
    console.error('Device access check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { auth, authorize, checkDeviceAccess };