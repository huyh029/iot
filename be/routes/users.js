const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Device = require('../models/Device');

const router = express.Router();

// Get all users (SuperAdmin only)
router.get('/', auth, authorize('superadmin'), async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const wsService = req.app.get('wsService');

    let query = {};
    
    if (role && role !== 'all') {
      query.role = role;
    }
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .populate('managerId', 'username fullName')
      .populate('deviceIds', 'deviceId name location')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get users by manager (Manager and User - get their users)
router.get('/my-users', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const currentUser = req.userDoc;

    // User không có quyền xem danh sách users, trả về empty
    if (currentUser.role === 'user') {
      return res.json({
        users: [],
        totalPages: 0,
        currentPage: 1,
        total: 0
      });
    }

    // Manager xem users của mình
    let query = { managerId: currentUser._id };
    
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .populate('deviceIds', 'deviceId name location')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get my users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new user
router.post('/', auth, async (req, res) => {
  try {
    const { username, email, password, fullName, phone, address, role } = req.body;
    const wsService = req.app.get('wsService');
    const currentUser = req.userDoc;

    console.log('📝 Creating user:', { username, email, role, passwordLength: password?.length });

    // Check permissions
    if (currentUser.role === 'superadmin' && !['manager', 'user'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    if (currentUser.role === 'manager' && role !== 'user') {
      return res.status(403).json({ message: 'Managers can only create users' });
    }

    if (currentUser.role === 'user') {
      return res.status(403).json({ message: 'Users cannot create accounts' });
    }

    // Check if username or email already exists
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Create user
    const userData = {
      username,
      email,
      password,
      fullName,
      phone,
      address,
      role,
      createdBy: currentUser._id
    };

    // Set managerId for users created by manager
    if (currentUser.role === 'manager') {
      userData.managerId = currentUser._id;
    }

    const user = new User(userData);
    await user.save();

    // Populate references
    await user.populate('managerId', 'username fullName');

    // Send real-time notification
    wsService.broadcastUserUpdate(currentUser._id, user);

    // Send notification to created user (if they're online)
    wsService.sendNotificationToUser(user._id, {
      type: 'account_created',
      message: `Your account has been created successfully. Welcome to Smart Garden!`,
      severity: 'success'
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user
router.put('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { fullName, email, phone, address, isActive } = req.body;
    const wsService = req.app.get('wsService');
    const currentUser = req.userDoc;

    // Find user to update
    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check permissions
    if (currentUser.role === 'manager') {
      // Manager can only update their own users
      if (userToUpdate.managerId?.toString() !== currentUser._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (currentUser.role === 'user') {
      // Users can only update themselves
      if (userToUpdate._id.toString() !== currentUser._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { fullName, email, phone, address, isActive },
      { new: true, runValidators: true }
    ).populate('managerId', 'username fullName')
     .populate('deviceIds', 'deviceId name location');

    // Send real-time update
    wsService.broadcastUserUpdate(currentUser._id, updatedUser);

    // Send notification to updated user
    wsService.sendNotificationToUser(userId, {
      type: 'profile_updated',
      message: 'Your profile has been updated',
      severity: 'info'
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign devices to user
router.post('/:userId/assign-devices', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { deviceIds } = req.body;
    const wsService = req.app.get('wsService');
    const currentUser = req.userDoc;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check permissions
    if (currentUser.role === 'manager') {
      // Manager can only assign devices they own to their users
      if (user.managerId?.toString() !== currentUser._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Verify all devices belong to the manager
      const devices = await Device.find({ 
        _id: { $in: deviceIds },
        ownerId: currentUser._id 
      });

      if (devices.length !== deviceIds.length) {
        return res.status(400).json({ message: 'Some devices do not belong to you' });
      }
    } else if (currentUser.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update user's device assignments
    user.deviceIds = deviceIds;
    await user.save();

    // Update devices' assigned users
    await Device.updateMany(
      { _id: { $in: deviceIds } },
      { $addToSet: { assignedUsers: userId } }
    );

    // Remove user from devices not in the new list
    await Device.updateMany(
      { 
        _id: { $nin: deviceIds },
        assignedUsers: userId 
      },
      { $pull: { assignedUsers: userId } }
    );

    await user.populate('deviceIds', 'deviceId name location');

    // Send real-time update
    wsService.broadcastUserUpdate(currentUser._id, user);

    // Send notification to user
    wsService.sendNotificationToUser(userId, {
      type: 'devices_assigned',
      message: `You have been assigned ${deviceIds.length} device(s)`,
      severity: 'info'
    });

    res.json(user);
  } catch (error) {
    console.error('Assign devices error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (soft delete)
router.delete('/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const wsService = req.app.get('wsService');
    const currentUser = req.userDoc;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check permissions
    if (currentUser.role === 'manager') {
      // Manager can only delete their users
      if (user.managerId?.toString() !== currentUser._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (currentUser.role !== 'superadmin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Prevent deleting superadmin
    if (user.role === 'superadmin') {
      return res.status(400).json({ message: 'Cannot delete superadmin' });
    }

    // Soft delete
    user.isActive = false;
    await user.save();

    // Remove user from all device assignments
    await Device.updateMany(
      { assignedUsers: userId },
      { $pull: { assignedUsers: userId } }
    );

    // Send real-time update
    wsService.broadcastUserUpdate(currentUser._id, { ...user.toObject(), deleted: true });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user statistics
router.get('/stats', auth, authorize('superadmin', 'manager'), async (req, res) => {
  try {
    const currentUser = req.userDoc;

    let query = {};
    if (currentUser.role === 'manager') {
      query.managerId = currentUser._id;
    }

    const totalUsers = await User.countDocuments(query);
    const activeUsers = await User.countDocuments({ ...query, isActive: true });
    const usersByRole = await User.aggregate([
      { $match: query },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    const recentUsers = await User.find(query)
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username fullName role createdAt');

    res.json({
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      usersByRole,
      recentUsers
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;