const express = require('express');
const { auth, checkDeviceAccess } = require('../middleware/auth');
const Plant = require('../models/Plant');
const Device = require('../models/Device');

const router = express.Router();

// Get plants for a device
router.get('/device/:deviceId', auth, checkDeviceAccess, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { page = 1, limit = 10, stage, search } = req.query;

    let query = { deviceId, isActive: true };

    if (stage && stage !== 'all') {
      query.growthStage = stage;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { variety: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } }
      ];
    }

    const plants = await Plant.find(query)
      .populate('userId', 'username fullName')
      .sort({ plantedDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Calculate growth progress for each plant
    const plantsWithProgress = plants.map(plant => {
      plant.calculateGrowthProgress();
      return plant;
    });

    const total = await Plant.countDocuments(query);

    res.json({
      plants: plantsWithProgress,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get plants error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all plants for user
router.get('/my-plants', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, stage, search } = req.query;
    const currentUser = req.userDoc;

    let query = { isActive: true };

    // User thấy plants của mình VÀ của Manager (createdBy)
    if (currentUser.role === 'user') {
      const userIds = [currentUser._id];
      if (currentUser.createdBy) {
        userIds.push(currentUser.createdBy);
      }
      query.userId = { $in: userIds };
    } else if (currentUser.role === 'manager') {
      // Manager thấy plants trên các thiết bị mà họ sở hữu
      const devices = await Device.find({ ownerId: currentUser._id }).select('_id');
      query.deviceId = { $in: devices.map(d => d._id) };
    } else {
      query.userId = currentUser._id;
    }

    if (stage && stage !== 'all') {
      query.growthStage = stage;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { variety: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } }
      ];
    }

    const plants = await Plant.find(query)
      .populate('deviceId', 'deviceId name location')
      .sort({ plantedDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Calculate growth progress for each plant
    const plantsWithProgress = plants.map(plant => {
      plant.calculateGrowthProgress();
      return plant;
    });

    const total = await Plant.countDocuments(query);

    res.json({
      plants: plantsWithProgress,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get my plants error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single plant
router.get('/:plantId', auth, async (req, res) => {
  try {
    const { plantId } = req.params;
    const currentUser = req.userDoc;

    const plant = await Plant.findById(plantId)
      .populate('deviceId', 'deviceId name location')
      .populate('userId', 'username fullName');

    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }

    // Check access permissions
    if (currentUser.role === 'user' && plant.userId._id.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (currentUser.role === 'manager') {
      const device = await Device.findById(plant.deviceId._id);
      if (device.ownerId.toString() !== currentUser._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    plant.calculateGrowthProgress();

    res.json(plant);
  } catch (error) {
    console.error('Get plant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new plant
router.post('/', auth, async (req, res) => {
  try {
    const {
      name,
      type,
      variety,
      deviceId,
      plantedDate,
      expectedHarvestDate,
      location,
      optimalConditions
    } = req.body;
    const wsService = req.app.get('wsService');
    const currentUser = req.userDoc;

    // Check device access
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    if (currentUser.role === 'user' && !currentUser.deviceIds.includes(deviceId)) {
      return res.status(403).json({ message: 'Access denied to this device' });
    }

    if (currentUser.role === 'manager' && device.ownerId.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ message: 'Access denied to this device' });
    }

    const plant = new Plant({
      name,
      type,
      variety,
      deviceId,
      userId: currentUser._id,
      plantedDate: plantedDate || new Date(),
      expectedHarvestDate,
      location,
      optimalConditions
    });

    plant.calculateGrowthProgress();
    await plant.save();

    await plant.populate('deviceId', 'deviceId name location');
    await plant.populate('userId', 'username fullName');

    // Send real-time update
    wsService.broadcastPlantUpdate(deviceId, plant);

    // Send notification
    wsService.sendNotificationToUser(currentUser._id, {
      type: 'plant_created',
      message: `New plant "${plant.name}" has been added`,
      severity: 'success',
      deviceId: deviceId,
      plantId: plant._id
    });

    res.status(201).json(plant);
  } catch (error) {
    console.error('Create plant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update plant
router.put('/:plantId', auth, async (req, res) => {
  try {
    const { plantId } = req.params;
    const updates = req.body;
    const wsService = req.app.get('wsService');
    const currentUser = req.userDoc;

    const plant = await Plant.findById(plantId);
    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }

    // Check permissions
    if (currentUser.role === 'user' && plant.userId.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (currentUser.role === 'manager') {
      const device = await Device.findById(plant.deviceId);
      if (device.ownerId.toString() !== currentUser._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Update plant
    Object.assign(plant, updates);
    plant.calculateGrowthProgress();
    await plant.save();

    await plant.populate('deviceId', 'deviceId name location');
    await plant.populate('userId', 'username fullName');

    // Send real-time update
    wsService.broadcastPlantUpdate(plant.deviceId._id, plant);

    res.json(plant);
  } catch (error) {
    console.error('Update plant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add note to plant
router.post('/:plantId/notes', auth, async (req, res) => {
  try {
    const { plantId } = req.params;
    const { content } = req.body;
    const wsService = req.app.get('wsService');
    const currentUser = req.userDoc;

    const plant = await Plant.findById(plantId);
    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }

    // Check permissions
    if (currentUser.role === 'user' && plant.userId.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    plant.notes.push({
      content,
      addedBy: currentUser._id,
      date: new Date()
    });

    await plant.save();
    await plant.populate('notes.addedBy', 'username fullName');

    // Send real-time update
    wsService.broadcastPlantUpdate(plant.deviceId, plant);

    res.json(plant);
  } catch (error) {
    console.error('Add plant note error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get plants nearing harvest
router.get('/harvest/upcoming', auth, async (req, res) => {
  try {
    const currentUser = req.userDoc;
    const { threshold = 80 } = req.query;

    let query = { isActive: true };

    if (currentUser.role === 'user') {
      query.userId = currentUser._id;
    } else if (currentUser.role === 'manager') {
      // Get devices owned by manager
      const devices = await Device.find({ ownerId: currentUser._id }).select('_id');
      query.deviceId = { $in: devices.map(d => d._id) };
    }

    const plants = await Plant.find(query)
      .populate('deviceId', 'deviceId name location')
      .populate('userId', 'username fullName');

    // Filter plants by growth progress
    const nearHarvestPlants = plants.filter(plant => {
      plant.calculateGrowthProgress();
      return plant.growthProgress >= threshold;
    });

    res.json(nearHarvestPlants);
  } catch (error) {
    console.error('Get harvest plants error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark plant as harvested
router.post('/:plantId/harvest', auth, async (req, res) => {
  try {
    const { plantId } = req.params;
    const { harvestDate, notes } = req.body;
    const wsService = req.app.get('wsService');
    const currentUser = req.userDoc;

    const plant = await Plant.findById(plantId);
    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }

    // Check permissions
    if (currentUser.role === 'user' && plant.userId.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    plant.growthStage = 'harvest';
    plant.growthProgress = 100;
    plant.isActive = false; // Mark as completed

    if (notes) {
      plant.notes.push({
        content: `Harvested: ${notes}`,
        addedBy: currentUser._id,
        date: harvestDate || new Date()
      });
    }

    await plant.save();

    // Send real-time update
    wsService.broadcastPlantUpdate(plant.deviceId, plant);

    // Send notification
    wsService.sendNotificationToUser(plant.userId, {
      type: 'plant_harvested',
      message: `${plant.name} has been harvested successfully!`,
      severity: 'success',
      deviceId: plant.deviceId,
      plantId: plant._id
    });

    res.json(plant);
  } catch (error) {
    console.error('Harvest plant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete plant
router.delete('/:plantId', auth, async (req, res) => {
  try {
    const { plantId } = req.params;
    const wsService = req.app.get('wsService');
    const currentUser = req.userDoc;

    const plant = await Plant.findById(plantId);
    if (!plant) {
      return res.status(404).json({ message: 'Plant not found' });
    }

    // Check permissions
    if (currentUser.role === 'user' && plant.userId.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (currentUser.role === 'manager') {
      const device = await Device.findById(plant.deviceId);
      if (device.ownerId.toString() !== currentUser._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Soft delete
    plant.isActive = false;
    await plant.save();

    // Send real-time update
    wsService.broadcastPlantUpdate(plant.deviceId, { ...plant.toObject(), deleted: true });

    res.json({ message: 'Plant deleted successfully' });
  } catch (error) {
    console.error('Delete plant error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;