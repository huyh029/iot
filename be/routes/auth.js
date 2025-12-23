const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const wsService = req.app.get('wsService');

    // Find user
    const user = await User.findOne({ username }).populate('managerId', 'username fullName');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account is deactivated' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    // Send login notification via WebSocket
    wsService.sendNotificationToUser(user._id, {
      type: 'login',
      message: 'You have successfully logged in',
      severity: 'info'
    });

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        managerId: user.managerId,
        deviceIds: user.deviceIds
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .populate('managerId', 'username fullName')
      .populate('deviceIds', 'deviceId name location status');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { fullName, email, phone, address } = req.body;
    const wsService = req.app.get('wsService');

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { fullName, email, phone, address },
      { new: true, runValidators: true }
    ).populate('managerId', 'username fullName');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Send profile update notification
    wsService.sendNotificationToUser(user._id, {
      type: 'profile_updated',
      message: 'Your profile has been updated successfully',
      severity: 'success'
    });

    res.json(user);
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password
router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const wsService = req.app.get('wsService');

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Send password change notification
    wsService.sendNotificationToUser(user._id, {
      type: 'password_changed',
      message: 'Your password has been changed successfully',
      severity: 'success'
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout (client-side token removal, but we can log the event)
router.post('/logout', auth, async (req, res) => {
  try {
    const wsService = req.app.get('wsService');

    // Send logout notification
    wsService.sendNotificationToUser(req.user.userId, {
      type: 'logout',
      message: 'You have been logged out',
      severity: 'info'
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;