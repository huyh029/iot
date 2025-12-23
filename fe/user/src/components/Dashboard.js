import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import config from '../config';
import './Dashboard.css';

const API_BASE = config.API_BASE_URL;

const Dashboard = () => {
  const [stats, setStats] = useState({
    devices: 0,
    plants: 0,
    onlineDevices: 0,
    activeControls: 0
  });
  const [recentPlants, setRecentPlants] = useState([]);
  const [sensorData, setSensorData] = useState({
    temperature: { value: null, unit: '°C' },
    humidity: { value: null, unit: '%' },
    light: { value: null, unit: 'lux' },
    soil_moisture: { value: null, unit: '%' },
    wind: { value: null, unit: 'km/h' },
    loading: true
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { connected } = useSocket();
  const socketRef = useRef(null);

  // Helper to update sensor data without losing existing values
  const updateSensorData = (newData) => {
    setSensorData(prev => ({
      temperature: { value: newData.temperature ?? prev.temperature?.value, unit: '°C' },
      humidity: { value: newData.humidity ?? prev.humidity?.value, unit: '%' },
      light: { value: newData.light ?? prev.light?.value, unit: 'lux' },
      soil_moisture: { value: newData.soil_moisture ?? prev.soil_moisture?.value, unit: '%' },
      wind: { value: newData.wind ?? prev.wind?.value, unit: 'km/h' },
      timestamp: newData.timestamp || prev.timestamp,
      source: newData.source || prev.source,
      loading: false
    }));
  };

  // WebSocket connection for realtime updates
  useEffect(() => {
    import('socket.io-client').then(({ io }) => {
      const socket = io('https://beiot.onrender.com', {
        transports: ['websocket', 'polling']
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('✅ WebSocket connected');
      });

      socket.on('thingsboard-telemetry', (payload) => {
        console.log('📥 Realtime telemetry:', payload.data);
        if (payload.data) {
          updateSensorData({
            temperature: payload.data.temperature,
            humidity: payload.data.humidity,
            light: payload.data.light,
            soil_moisture: payload.data.soil_moisture,
            wind: payload.data.wind,
            timestamp: payload.data.timestamp,
            source: 'realtime'
          });
        }
      });

      return () => {
        socket.disconnect();
      };
    });
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, plantsRes, thingsboardRes] = await Promise.all([
        fetch(`${API_BASE}/api/dashboard/stats`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`${API_BASE}/api/plants/my-plants?limit=5`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }),
        fetch(`${API_BASE}/api/thingsboard/sensors`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }).catch(() => null)
      ]);

      if (statsRes.ok && plantsRes.ok) {
        const statsData = await statsRes.json();
        const plantsData = await plantsRes.json();
        
        setStats(statsData);
        setRecentPlants(plantsData.plants || []);
      } else {
        setError('Không thể tải dữ liệu dashboard');
      }

      // Get sensor data from ThingsBoard
      if (thingsboardRes && thingsboardRes.ok) {
        const tbData = await thingsboardRes.json();
        if (tbData.available) {
          updateSensorData({
            temperature: tbData.temperature?.value,
            humidity: tbData.humidity?.value,
            light: tbData.light?.value,
            soil_moisture: tbData.soil_moisture?.value,
            wind: tbData.wind?.value,
            timestamp: tbData.timestamp,
            source: tbData.source
          });
        } else {
          setSensorData(prev => ({ ...prev, loading: false }));
        }
      } else {
        setSensorData(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

  const calculateGrowthProgress = (plantedDate, expectedHarvestDate) => {
    if (!expectedHarvestDate) return 0;
    
    const planted = new Date(plantedDate);
    const expected = new Date(expectedHarvestDate);
    const now = new Date();
    
    const totalDays = Math.ceil((expected - planted) / (1000 * 60 * 60 * 24));
    const daysPassed = Math.ceil((now - planted) / (1000 * 60 * 60 * 24));
    
    const progress = Math.min(Math.max((daysPassed / totalDays) * 100, 0), 100);
    return Math.round(progress);
  };

  const getDaysUntilHarvest = (expectedHarvestDate) => {
    const expected = new Date(expectedHarvestDate);
    const now = new Date();
    const diffTime = expected - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) return 'Đã đến lúc thu hoạch';
    if (diffDays === 1) return '1 ngày nữa';
    if (diffDays <= 7) return `${diffDays} ngày nữa`;
    return `${Math.ceil(diffDays / 7)} tuần nữa`;
  };

  const getPlantIcon = (type) => {
    switch (type) {
      case 'vegetable': return 'nutrition';
      case 'fruit': return 'nutrition';
      case 'herb': return 'grass';
      case 'flower': return 'psychiatry';
      default: return 'eco';
    }
  };

  const getPlantColor = (type) => {
    switch (type) {
      case 'vegetable': return 'red';
      case 'fruit': return 'red';
      case 'herb': return 'green';
      case 'flower': return 'orange';
      default: return 'green';
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        {error}
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Heading Section */}
      <div className="dashboard-header">
        <div className="header-text">
          <h2 className="dashboard-title">Xin chào, User</h2>
          <p className="dashboard-subtitle">
            {new Date().toLocaleDateString('vi-VN', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })} - Tổng quan vườn
          </p>
        </div>
        <button className="add-device-button">
          <span className="material-symbols-outlined">add</span>
          Thêm cây trồng mới
        </button>
      </div>

      {/* Bento Grid Layout */}
      <div className="dashboard-grid">
        {/* LEFT COLUMN: Weather & Quick Stats */}
        <div className="left-column">
          {/* Main Weather Card */}
          <div className="weather-card">
            <div className="weather-bg-decoration"></div>
            
            <div className="weather-header">
              <div className="weather-location">
                <h3 className="weather-title">Thời tiết hiện tại</h3>
                <p className="weather-location-text">ThingsBoard Sensor</p>
              </div>
              <span className="material-symbols-outlined weather-main-icon icon-fill">sunny</span>
            </div>

            <div className="weather-temperature">
              <span className="temp-value">
                {sensorData.loading ? '...' : (
                  sensorData.temperature?.value != null ? Math.round(sensorData.temperature.value) : '--'
                )}°
              </span>
              <span className="temp-unit">C</span>
            </div>

            <div className="weather-details">
              <div className="weather-detail-item">
                <div className="weather-detail-header">
                  <span className="material-symbols-outlined">water_drop</span>
                  <span className="weather-detail-label">Độ ẩm</span>
                </div>
                <span className="weather-detail-value">
                  {sensorData.humidity?.value != null ? Math.round(sensorData.humidity.value) : '--'}%
                </span>
              </div>
              <div className="weather-detail-item">
                <div className="weather-detail-header">
                  <span className="material-symbols-outlined">air</span>
                  <span className="weather-detail-label">Gió</span>
                </div>
                <span className="weather-detail-value">
                  {sensorData.wind?.value != null ? Math.round(sensorData.wind.value) : '--'} km/h
                </span>
              </div>
              <div className="weather-detail-item">
                <div className="weather-detail-header">
                  <span className="material-symbols-outlined">light_mode</span>
                  <span className="weather-detail-label">Ánh sáng</span>
                </div>
                <span className="weather-detail-value">
                  {sensorData.light?.value != null ? Math.round(sensorData.light.value) : '--'} lx
                </span>
              </div>
              <div className="weather-detail-item">
                <div className="weather-detail-header">
                  <span className="material-symbols-outlined">grass</span>
                  <span className="weather-detail-label">Độ ẩm đất</span>
                </div>
                <span className="weather-detail-value">
                  {sensorData.soil_moisture?.value != null ? Math.round(sensorData.soil_moisture.value) : '--'}%
                </span>
              </div>
            </div>

            {/* Connection Status */}
            <div className="weather-forecast">
              <h4 className="forecast-title">Trạng thái kết nối</h4>
              <div className="forecast-list">
                <div className="forecast-item">
                  <span className="forecast-day">WebSocket</span>
                  <span className={`material-symbols-outlined forecast-icon ${connected ? 'icon-fill' : ''}`}>
                    {connected ? 'check_circle' : 'cancel'}
                  </span>
                  <span className="forecast-temp">{connected ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Harvest Readiness List */}
          <div className="harvest-card">
            <div className="harvest-header">
              <h3 className="harvest-title">Sắp thu hoạch</h3>
              <a href="/plants" className="harvest-link">Xem tất cả</a>
            </div>
            <div className="harvest-list">
              {recentPlants.filter(plant => {
                const progress = calculateGrowthProgress(plant.plantedDate, plant.expectedHarvestDate);
                return progress >= 80;
              }).slice(0, 3).map(plant => {
                const progress = calculateGrowthProgress(plant.plantedDate, plant.expectedHarvestDate);
                const daysUntil = getDaysUntilHarvest(plant.expectedHarvestDate);
                const color = getPlantColor(plant.type);
                
                return (
                  <div key={plant._id} className="harvest-item">
                    <div className="harvest-item-header">
                      <div className="harvest-item-info">
                        <div className={`harvest-item-icon ${color}`}>
                          <span className="material-symbols-outlined icon-fill">
                            {getPlantIcon(plant.type)}
                          </span>
                        </div>
                        <div className="harvest-item-text">
                          <p className="harvest-item-name">{plant.name}</p>
                          <p className="harvest-item-location">Khu vực A2</p>
                        </div>
                      </div>
                      <span className={`harvest-item-time ${progress >= 90 ? 'ready' : 'pending'}`}>
                        {daysUntil}
                      </span>
                    </div>
                    <div className="harvest-progress-bar">
                      <div 
                        className="harvest-progress-fill" 
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
              
              {recentPlants.filter(plant => {
                const progress = calculateGrowthProgress(plant.plantedDate, plant.expectedHarvestDate);
                return progress >= 80;
              }).length === 0 && (
                <div className="no-harvest">
                  <span className="material-symbols-outlined">eco</span>
                  <p>Chưa có cây nào sắp thu hoạch</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Stats & Activity */}
        <div className="right-column">
          {/* Device Status Grid */}
          <div className="stats-grid">
            <div className="stat-card online">
              <div className="stat-card-header">
                <div className="stat-card-icon primary">
                  <span className="material-symbols-outlined icon-fill">memory</span>
                </div>
                <span className="stat-card-badge online">Online</span>
              </div>
              <div className="stat-card-content">
                <p className="stat-card-value">{stats.onlineDevices}/{stats.devices}</p>
                <p className="stat-card-label">Thiết bị đang hoạt động</p>
              </div>
            </div>

            <div className="stat-card active">
              <div className="stat-card-header">
                <div className="stat-card-icon blue">
                  <span className="material-symbols-outlined icon-fill">water_pump</span>
                </div>
                <span className="stat-card-badge active">Active</span>
              </div>
              <div className="stat-card-content">
                <p className="stat-card-value">{stats.activeControls}</p>
                <p className="stat-card-label">Điều khiển đang chạy</p>
              </div>
            </div>

            <div className="stat-card warning">
              <div className="stat-card-header">
                <div className="stat-card-icon yellow">
                  <span className="material-symbols-outlined icon-fill">eco</span>
                </div>
                <span className="stat-card-badge warning">Growing</span>
              </div>
              <div className="stat-card-content">
                <p className="stat-card-value">{stats.plants}</p>
                <p className="stat-card-label">Cây trồng đang theo dõi</p>
              </div>
            </div>
          </div>

          {/* System Logs / Activity Table */}
          <div className="activity-card">
            <div className="activity-header">
              <h3 className="activity-title">Hoạt động gần đây</h3>
            </div>
            <div className="activity-table">
              <div className="activity-table-header">
                <div className="activity-col">Thời gian</div>
                <div className="activity-col">Thiết bị</div>
                <div className="activity-col">Hành động</div>
                <div className="activity-col activity-col-right">Trạng thái</div>
              </div>
              <div className="activity-table-body">
                <div className="activity-row">
                  <div className="activity-col activity-time">10:32 AM</div>
                  <div className="activity-col activity-device">Pump-01</div>
                  <div className="activity-col activity-action">Tự động tưới (Zone A)</div>
                  <div className="activity-col activity-col-right activity-status success">Hoàn thành</div>
                </div>
                <div className="activity-row">
                  <div className="activity-col activity-time">09:15 AM</div>
                  <div className="activity-col activity-device">Sensor-Temp-03</div>
                  <div className="activity-col activity-action">Cập nhật dữ liệu</div>
                  <div className="activity-col activity-col-right activity-status success">Hoàn thành</div>
                </div>
                <div className="activity-row">
                  <div className="activity-col activity-time">08:00 AM</div>
                  <div className="activity-col activity-device">System</div>
                  <div className="activity-col activity-action">Đồng bộ dữ liệu</div>
                  <div className="activity-col activity-col-right activity-status success">Hoàn thành</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;