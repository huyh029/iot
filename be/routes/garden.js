const express = require('express');
const { auth } = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Get garden settings for user
router.get('/settings', auth, async (req, res) => {
  try {
    const user = req.userDoc;
    
    // Return garden settings from user document or defaults
    const gardenSettings = user.gardenSettings || {
      zones: [],
      cameraUrl: ''
    };
    
    res.json(gardenSettings);
  } catch (error) {
    console.error('Get garden settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Save garden settings
router.post('/settings', auth, async (req, res) => {
  try {
    const { zones, cameraUrl } = req.body;
    const user = req.userDoc;
    
    // Update user's garden settings
    user.gardenSettings = {
      zones: zones || [],
      cameraUrl: cameraUrl || ''
    };
    
    user.markModified('gardenSettings');
    await user.save();
    
    res.json({ 
      success: true, 
      message: 'Garden settings saved',
      gardenSettings: user.gardenSettings 
    });
  } catch (error) {
    console.error('Save garden settings error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update camera URL only
router.put('/camera', auth, async (req, res) => {
  try {
    const { cameraUrl } = req.body;
    const user = req.userDoc;
    
    if (!user.gardenSettings) {
      user.gardenSettings = { zones: [], cameraUrl: '' };
    }
    
    user.gardenSettings.cameraUrl = cameraUrl || '';
    user.markModified('gardenSettings');
    await user.save();
    
    res.json({ 
      success: true, 
      cameraUrl: user.gardenSettings.cameraUrl 
    });
  } catch (error) {
    console.error('Update camera URL error:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update zones only
router.put('/zones', auth, async (req, res) => {
  try {
    const { zones } = req.body;
    const user = req.userDoc;
    
    console.log('Updating zones for user:', user._id);
    console.log('Zones data:', JSON.stringify(zones));
    
    if (!user.gardenSettings) {
      user.gardenSettings = { zones: [], cameraUrl: '' };
    }
    
    user.gardenSettings.zones = zones || [];
    user.markModified('gardenSettings'); // Mark nested object as modified
    await user.save();
    
    console.log('Zones saved successfully');
    
    res.json({ 
      success: true, 
      zones: user.gardenSettings.zones 
    });
  } catch (error) {
    console.error('Update zones error:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
