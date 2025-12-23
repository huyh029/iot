const express = require('express');
const axios = require('axios');
const { auth } = require('../middleware/auth');
const Device = require('../models/Device');

const router = express.Router();

// Get weather data for a location
router.get('/location', auth, async (req, res) => {
  try {
    const { lat, lon, deviceId } = req.query;
    const wsService = req.app.get('wsService');

    if (!lat || !lon) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    if (!process.env.WEATHER_API_KEY) {
      return res.status(500).json({ message: 'Weather API key not configured' });
    }

    // Get current weather
    const currentWeatherResponse = await axios.get(
      `${process.env.WEATHER_API_URL}/weather?lat=${lat}&lon=${lon}&appid=${process.env.WEATHER_API_KEY}&units=metric`
    );

    // Get 5-day forecast
    const forecastResponse = await axios.get(
      `${process.env.WEATHER_API_URL}/forecast?lat=${lat}&lon=${lon}&appid=${process.env.WEATHER_API_KEY}&units=metric`
    );

    const weatherData = {
      current: {
        temperature: currentWeatherResponse.data.main.temp,
        humidity: currentWeatherResponse.data.main.humidity,
        pressure: currentWeatherResponse.data.main.pressure,
        windSpeed: currentWeatherResponse.data.wind.speed,
        windDirection: currentWeatherResponse.data.wind.deg,
        description: currentWeatherResponse.data.weather[0].description,
        icon: currentWeatherResponse.data.weather[0].icon,
        visibility: currentWeatherResponse.data.visibility,
        uvIndex: currentWeatherResponse.data.uvi || 0,
        timestamp: new Date()
      },
      forecast: forecastResponse.data.list.map(item => ({
        datetime: new Date(item.dt * 1000),
        temperature: item.main.temp,
        humidity: item.main.humidity,
        pressure: item.main.pressure,
        windSpeed: item.wind.speed,
        windDirection: item.wind.deg,
        description: item.weather[0].description,
        icon: item.weather[0].icon,
        precipitation: item.rain ? item.rain['3h'] || 0 : 0
      })),
      location: {
        name: currentWeatherResponse.data.name,
        country: currentWeatherResponse.data.sys.country,
        latitude: lat,
        longitude: lon
      }
    };

    // Send real-time weather update if deviceId provided
    if (deviceId) {
      wsService.broadcastWeatherUpdate({ lat, lon }, weatherData);
    }

    res.json(weatherData);
  } catch (error) {
    console.error('Weather API error:', error);
    if (error.response?.status === 401) {
      res.status(401).json({ message: 'Invalid weather API key' });
    } else if (error.response?.status === 404) {
      res.status(404).json({ message: 'Location not found' });
    } else {
      res.status(500).json({ message: 'Weather service unavailable' });
    }
  }
});

// Get weather for device location
router.get('/device/:deviceId', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const currentUser = req.userDoc;

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    // Check access permissions
    if (currentUser.role === 'user' && !currentUser.deviceIds.includes(deviceId)) {
      return res.status(403).json({ message: 'Access denied to this device' });
    }

    if (currentUser.role === 'manager' && device.ownerId.toString() !== currentUser._id.toString()) {
      return res.status(403).json({ message: 'Access denied to this device' });
    }

    // Get weather for device location
    const weatherResponse = await axios.get(
      `/api/weather/location?lat=${device.location.latitude}&lon=${device.location.longitude}&deviceId=${deviceId}`,
      {
        headers: { Authorization: req.headers.authorization }
      }
    );

    res.json(weatherResponse.data);
  } catch (error) {
    console.error('Device weather error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get weather alerts for location
router.get('/alerts', auth, async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    if (!process.env.WEATHER_API_KEY) {
      return res.status(500).json({ message: 'Weather API key not configured' });
    }

    // Get weather alerts (if available in your weather API)
    const alertsResponse = await axios.get(
      `${process.env.WEATHER_API_URL}/onecall?lat=${lat}&lon=${lon}&appid=${process.env.WEATHER_API_KEY}&exclude=minutely,hourly,daily`
    );

    const alerts = alertsResponse.data.alerts || [];

    const processedAlerts = alerts.map(alert => ({
      title: alert.event,
      description: alert.description,
      severity: alert.severity || 'moderate',
      start: new Date(alert.start * 1000),
      end: new Date(alert.end * 1000),
      source: alert.sender_name
    }));

    res.json(processedAlerts);
  } catch (error) {
    console.error('Weather alerts error:', error);
    res.status(500).json({ message: 'Weather alerts unavailable' });
  }
});

// Get historical weather data
router.get('/history', auth, async (req, res) => {
  try {
    const { lat, lon, date } = req.query;

    if (!lat || !lon || !date) {
      return res.status(400).json({ message: 'Latitude, longitude, and date are required' });
    }

    if (!process.env.WEATHER_API_KEY) {
      return res.status(500).json({ message: 'Weather API key not configured' });
    }

    const timestamp = Math.floor(new Date(date).getTime() / 1000);

    const historyResponse = await axios.get(
      `${process.env.WEATHER_API_URL}/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${timestamp}&appid=${process.env.WEATHER_API_KEY}&units=metric`
    );

    const historicalData = {
      date: new Date(date),
      temperature: historyResponse.data.current.temp,
      humidity: historyResponse.data.current.humidity,
      pressure: historyResponse.data.current.pressure,
      windSpeed: historyResponse.data.current.wind_speed,
      windDirection: historyResponse.data.current.wind_deg,
      description: historyResponse.data.current.weather[0].description,
      icon: historyResponse.data.current.weather[0].icon
    };

    res.json(historicalData);
  } catch (error) {
    console.error('Historical weather error:', error);
    res.status(500).json({ message: 'Historical weather data unavailable' });
  }
});

// Get weather statistics for location
router.get('/stats', auth, async (req, res) => {
  try {
    const { lat, lon, days = 7 } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    // This would typically require storing historical weather data
    // For now, we'll return mock statistics
    const stats = {
      period: `${days} days`,
      averageTemperature: 25.5,
      minTemperature: 18.2,
      maxTemperature: 32.1,
      averageHumidity: 65.3,
      totalRainfall: 12.5,
      averageWindSpeed: 8.2,
      dominantWeather: 'partly cloudy',
      location: { latitude: lat, longitude: lon }
    };

    res.json(stats);
  } catch (error) {
    console.error('Weather stats error:', error);
    res.status(500).json({ message: 'Weather statistics unavailable' });
  }
});

module.exports = router;