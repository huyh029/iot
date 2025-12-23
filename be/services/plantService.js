const Plant = require('../models/Plant');

class PlantService {
  static async updateGrowthProgress(wsService) {
    try {
      const activePlants = await Plant.find({ isActive: true }).populate('deviceId', 'name');

      for (const plant of activePlants) {
        const oldProgress = plant.growthProgress;
        const newProgress = plant.calculateGrowthProgress();

        // Only update if progress changed significantly (>1%)
        if (Math.abs(newProgress - oldProgress) >= 1) {
          plant.growthProgress = newProgress;
          
          // Update growth stage based on progress
          if (newProgress >= 90) {
            plant.growthStage = 'harvest';
          } else if (newProgress >= 70) {
            plant.growthStage = 'fruiting';
          } else if (newProgress >= 50) {
            plant.growthStage = 'flowering';
          } else if (newProgress >= 30) {
            plant.growthStage = 'vegetative';
          } else if (newProgress >= 10) {
            plant.growthStage = 'seedling';
          } else if (newProgress >= 5) {
            plant.growthStage = 'germination';
          }

          await plant.save();

          // Send real-time update
          wsService.broadcastPlantUpdate(plant.deviceId._id, plant);

          // Send notification for harvest-ready plants
          if (newProgress >= 90 && oldProgress < 90) {
            wsService.sendNotificationToUser(plant.userId, {
              type: 'harvest_ready',
              message: `${plant.name} (${plant.variety}) is ready for harvest!`,
              severity: 'success',
              deviceId: plant.deviceId._id,
              plantId: plant._id
            });
          }

          // Send notification for plants nearing harvest (80%)
          if (newProgress >= 80 && oldProgress < 80) {
            wsService.sendNotificationToUser(plant.userId, {
              type: 'harvest_soon',
              message: `${plant.name} (${plant.variety}) will be ready for harvest soon (${Math.round(newProgress)}% complete)`,
              severity: 'info',
              deviceId: plant.deviceId._id,
              plantId: plant._id
            });
          }
        }
      }

      console.log(`Updated growth progress for ${activePlants.length} plants`);
    } catch (error) {
      console.error('Plant service error:', error);
    }
  }

  static async updatePlantConditions(plantId, sensorData, wsService) {
    try {
      const plant = await Plant.findById(plantId);
      if (!plant) return;

      // Update current conditions
      plant.currentConditions = {
        ...plant.currentConditions,
        ...sensorData,
        lastUpdated: new Date()
      };

      await plant.save();

      // Check if conditions are optimal
      const alerts = this.checkOptimalConditions(plant);
      
      if (alerts.length > 0) {
        for (const alert of alerts) {
          wsService.sendNotificationToUser(plant.userId, {
            type: 'condition_alert',
            message: alert.message,
            severity: alert.severity,
            deviceId: plant.deviceId,
            plantId: plant._id
          });
        }
      }

      // Send real-time plant update
      wsService.broadcastPlantUpdate(plant.deviceId, plant);
    } catch (error) {
      console.error('Update plant conditions error:', error);
    }
  }

  static checkOptimalConditions(plant) {
    const alerts = [];
    const { currentConditions, optimalConditions } = plant;

    // Check temperature
    if (optimalConditions.temperature) {
      if (currentConditions.temperature < optimalConditions.temperature.min) {
        alerts.push({
          message: `${plant.name}: Temperature too low (${currentConditions.temperature}°C)`,
          severity: 'warning'
        });
      } else if (currentConditions.temperature > optimalConditions.temperature.max) {
        alerts.push({
          message: `${plant.name}: Temperature too high (${currentConditions.temperature}°C)`,
          severity: 'warning'
        });
      }
    }

    // Check humidity
    if (optimalConditions.humidity) {
      if (currentConditions.humidity < optimalConditions.humidity.min) {
        alerts.push({
          message: `${plant.name}: Humidity too low (${currentConditions.humidity}%)`,
          severity: 'warning'
        });
      } else if (currentConditions.humidity > optimalConditions.humidity.max) {
        alerts.push({
          message: `${plant.name}: Humidity too high (${currentConditions.humidity}%)`,
          severity: 'warning'
        });
      }
    }

    // Check light
    if (optimalConditions.light) {
      if (currentConditions.light < optimalConditions.light.min) {
        alerts.push({
          message: `${plant.name}: Light level too low (${currentConditions.light} lux)`,
          severity: 'warning'
        });
      } else if (currentConditions.light > optimalConditions.light.max) {
        alerts.push({
          message: `${plant.name}: Light level too high (${currentConditions.light} lux)`,
          severity: 'warning'
        });
      }
    }

    // Check soil moisture
    if (optimalConditions.soilMoisture) {
      if (currentConditions.soilMoisture < optimalConditions.soilMoisture.min) {
        alerts.push({
          message: `${plant.name}: Soil moisture too low (${currentConditions.soilMoisture}%)`,
          severity: 'error'
        });
      } else if (currentConditions.soilMoisture > optimalConditions.soilMoisture.max) {
        alerts.push({
          message: `${plant.name}: Soil moisture too high (${currentConditions.soilMoisture}%)`,
          severity: 'warning'
        });
      }
    }

    return alerts;
  }
}

module.exports = PlantService;