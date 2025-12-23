import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import config from '../config';
import './GardenView.css';

const API_BASE = config.API_BASE_URL;

const GardenView = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [sensorData, setSensorData] = useState({});
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(0); // 0: map, 1: structure, 2: camera, 3: weather
  const { connected, joinDeviceRoom } = useSocket();

  useEffect(() => {
    fetchDevices();
    fetchWeatherData();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      fetchSensorData(selectedDevice._id);
      joinDeviceRoom(selectedDevice._id);
    }
  }, [selectedDevice, joinDeviceRoom]);

  const fetchDevices = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/devices/my-devices`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
        if (data.devices?.length > 0) {
          setSelectedDevice(data.devices[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSensorData = async (deviceId) => {
    try {
      const response = await fetch(`${API_BASE}/api/sensors/device/${deviceId}/latest`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const sensorArray = Array.isArray(data) ? data : (data.sensors ? data.sensors : []);
        setSensorData(prev => ({ ...prev, [deviceId]: sensorArray }));
      } else {
        setSensorData(prev => ({ ...prev, [deviceId]: [] }));
      }
    } catch (error) {
      console.error('Failed to fetch sensor data:', error);
      setSensorData(prev => ({ ...prev, [deviceId]: [] }));
    }
  };

  const fetchWeatherData = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/weather/current`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setWeatherData(data);
      }
    } catch (error) {
      console.error('Failed to fetch weather data:', error);
    }
  };

  const getSensorIcon = (sensorType) => {
    switch (sensorType) {
      case 'temperature': return 'device_thermostat';
      case 'humidity': return 'water_drop';
      case 'light': return 'light_mode';
      case 'soilMoisture': return 'grass';
      default: return 'sensors';
    }
  };

  const getSensorName = (sensorType) => {
    switch (sensorType) {
      case 'temperature': return 'Nhiệt độ';
      case 'humidity': return 'Độ ẩm';
      case 'light': return 'Ánh sáng';
      case 'soilMoisture': return 'Độ ẩm đất';
      default: return sensorType;
    }
  };

  const getSensorColor = (sensorType) => {
    switch (sensorType) {
      case 'temperature': return 'red';
      case 'humidity': return 'blue';
      case 'light': return 'yellow';
      case 'soilMoisture': return 'green';
      default: return 'gray';
    }
  };

  const viewModes = [
    { key: 0, label: 'Bản đồ', icon: 'location_on', desc: 'Vị trí thiết bị' },
    { key: 1, label: 'Cấu trúc', icon: 'account_tree', desc: 'Layout vườn' },
    { key: 2, label: 'Camera', icon: 'videocam', desc: 'Xem trực tiếp' },
    { key: 3, label: 'Thời tiết', icon: 'wb_sunny', desc: 'Dự báo' }
  ];

  if (loading) {
    return (
      <div className="garden-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="garden-container">
        <div className="garden-header">
          <div className="header-text">
            <h2 className="garden-title">Xem vườn trực tiếp</h2>
            <p className="garden-subtitle">Theo dõi vườn thông qua camera và cảm biến</p>
          </div>
        </div>
        <div className="warning-card">
          <div className="warning-icon">
            <span className="material-symbols-outlined">warning</span>
          </div>
          <div className="warning-content">
            <h3>Chưa có thiết bị</h3>
            <p>Bạn chưa có thiết bị nào được gán. Liên hệ Manager để được cấp thiết bị ESP32.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="garden-container">
      {/* Header */}
      <div className="garden-header">
        <div className="header-text">
          <h2 className="garden-title">Xem vườn trực tiếp</h2>
          <p className="garden-subtitle">Theo dõi vườn thông qua camera và cảm biến</p>
        </div>
        <div className="header-actions">
          <div className="device-selector">
            <label className="selector-label">Chọn thiết bị:</label>
            <select
              className="device-select"
              value={selectedDevice?._id || ''}
              onChange={(e) => {
                const device = devices.find(d => d._id === e.target.value);
                setSelectedDevice(device);
              }}
            >
              {devices.map(device => (
                <option key={device._id} value={device._id}>
                  {device.name} ({device.deviceId})
                </option>
              ))}
            </select>
          </div>
          <div className="connection-status">
            <span className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
              <span className="material-symbols-outlined">
                {connected ? 'sync' : 'sync_disabled'}
              </span>
              {connected ? 'Real-time' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Current Sensor Data */}
      {selectedDevice && (
        <div className="sensor-data-card">
          <div className="sensor-data-header">
            <h3 className="sensor-data-title">
              <span className="material-symbols-outlined">sensors</span>
              Dữ liệu sensor hiện tại - {selectedDevice.name}
            </h3>
          </div>
          
          {(() => {
            const deviceSensorData = sensorData[selectedDevice._id];
            const isValidArray = Array.isArray(deviceSensorData) && deviceSensorData.length > 0;
            
            return isValidArray ? (
              <div className="sensor-data-grid">
                {deviceSensorData.map((data, index) => {
                  const color = getSensorColor(data.sensorType);
                  return (
                    <div key={index} className="sensor-data-item">
                      <div className={`sensor-icon ${color}`}>
                        <span className="material-symbols-outlined icon-fill">
                          {getSensorIcon(data.sensorType)}
                        </span>
                      </div>
                      <div className="sensor-info">
                        <div className="sensor-value">
                          {data.value}{data.unit}
                        </div>
                        <div className="sensor-name">
                          {getSensorName(data.sensorType)}
                        </div>
                        <div className="sensor-time">
                          {new Date(data.timestamp).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-sensor-data">
                <div className="no-data-icon">
                  <span className="material-symbols-outlined">sensors_off</span>
                </div>
                <div className="no-data-content">
                  <h4>Chưa có dữ liệu sensor</h4>
                  <p>Thiết bị {selectedDevice.name} chưa gửi dữ liệu sensor nào</p>
                  {deviceSensorData && !Array.isArray(deviceSensorData) && (
                    <p className="error-info">
                      Dữ liệu không đúng định dạng: {typeof deviceSensorData}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="view-tabs-card">
        <div className="view-tabs">
          {viewModes.map(mode => (
            <button
              key={mode.key}
              className={`view-tab ${viewMode === mode.key ? 'active' : ''}`}
              onClick={() => setViewMode(mode.key)}
            >
              <span className="material-symbols-outlined tab-icon">
                {mode.icon}
              </span>
              <div className="tab-content">
                <div className="tab-label">{mode.label}</div>
                <div className="tab-desc">{mode.desc}</div>
              </div>
            </button>
          ))}
        </div>
        
        <div className="view-content">
          {viewMode === 0 && <MapView device={selectedDevice} />}
          {viewMode === 1 && <StructureView device={selectedDevice} />}
          {viewMode === 2 && <CameraView device={selectedDevice} />}
          {viewMode === 3 && <WeatherView weather={weatherData} />}
        </div>
      </div>
    </div>
  );
};

// Map View Component
const MapView = ({ device }) => {
  if (!device) return null;

  return (
    <div className="view-section">
      <div className="view-header">
        <h3 className="view-title">
          <span className="material-symbols-outlined">location_on</span>
          Bản đồ vị trí thiết bị
        </h3>
      </div>
      
      <div className="map-container">
        <div className="map-placeholder">
          <div className="map-markers">
            <div className="map-marker active">
              <div className="marker-pulse"></div>
              <div className="marker-dot"></div>
              <div className="marker-tooltip">
                {device.name} (Active)
              </div>
            </div>
          </div>
        </div>
        
        <div className="map-info">
          <div className="map-info-item">
            <span className="info-label">Tên thiết bị:</span>
            <span className="info-value">{device.name}</span>
          </div>
          <div className="map-info-item">
            <span className="info-label">Device ID:</span>
            <span className="info-value device-id">{device.deviceId}</span>
          </div>
          <div className="map-info-item">
            <span className="info-label">Địa chỉ:</span>
            <span className="info-value">{device.location.address}</span>
          </div>
          {device.location.coordinates && (
            <div className="map-info-item">
              <span className="info-label">Tọa độ:</span>
              <span className="info-value">
                {device.location.coordinates.lat}, {device.location.coordinates.lng}
              </span>
            </div>
          )}
          <div className="map-note">
            <span className="material-symbols-outlined">info</span>
            Tích hợp Google Maps sẽ được thêm trong phiên bản tiếp theo
          </div>
        </div>
      </div>
    </div>
  );
};

// Structure View Component
const StructureView = ({ device }) => {
  if (!device) return null;

  return (
    <div className="view-section">
      <div className="view-header">
        <h3 className="view-title">
          <span className="material-symbols-outlined">account_tree</span>
          Cấu trúc vườn
        </h3>
      </div>
      
      <div className="structure-container">
        <div className="structure-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(zone => (
            <div 
              key={zone} 
              className={`structure-zone ${zone === 1 ? 'active' : ''}`}
            >
              <div className="zone-icon">
                <span className="material-symbols-outlined">
                  {zone === 1 ? 'eco' : 'crop_square'}
                </span>
              </div>
              <div className="zone-label">
                {zone === 1 ? device.name : `Khu ${zone}`}
              </div>
            </div>
          ))}
        </div>
        
        <div className="structure-info">
          <div className="structure-legend">
            <div className="legend-item">
              <div className="legend-color active"></div>
              <span>Khu vực hiện tại</span>
            </div>
            <div className="legend-item">
              <div className="legend-color inactive"></div>
              <span>Khu vực khác</span>
            </div>
          </div>
          <div className="structure-note">
            <span className="material-symbols-outlined">info</span>
            Layout chi tiết vườn với các khu vực trồng trọt
          </div>
        </div>
      </div>
    </div>
  );
};

// Camera View Component
const CameraView = ({ device }) => {
  if (!device) return null;

  return (
    <div className="view-section">
      <div className="view-header">
        <h3 className="view-title">
          <span className="material-symbols-outlined">videocam</span>
          Camera trực tiếp
        </h3>
      </div>
      
      <div className="camera-container">
        <div className="camera-placeholder">
          <div className="camera-icon">
            <span className="material-symbols-outlined">videocam</span>
          </div>
          <div className="camera-info">
            <h4>Camera ESP32 - {device.name}</h4>
            <p>Xem vườn real-time qua camera tích hợp</p>
          </div>
          <div className="camera-status">
            <div className="status-item">
              <span className="material-symbols-outlined">build</span>
              <span>Tính năng đang phát triển</span>
            </div>
            <div className="status-item">
              <span className="material-symbols-outlined">videocam</span>
              <span>Camera stream sẽ hiển thị tại đây</span>
            </div>
            <div className="status-item">
              <span className="material-symbols-outlined">link</span>
              <span>URL: http://{device.deviceId}.local/stream</span>
            </div>
          </div>
          <div className="camera-controls">
            <button className="camera-control-btn">
              <span className="material-symbols-outlined">photo_camera</span>
              Chụp ảnh
            </button>
            <button className="camera-control-btn">
              <span className="material-symbols-outlined">videocam</span>
              Ghi video
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Weather View Component
const WeatherView = ({ weather }) => {
  return (
    <div className="view-section">
      <div className="view-header">
        <h3 className="view-title">
          <span className="material-symbols-outlined">wb_sunny</span>
          Thời tiết & Dự báo
        </h3>
      </div>
      
      <div className="weather-container">
        {weather ? (
          <div className="weather-content">
            <div className="weather-main">
              <div className="weather-icon-large">
                <span className="material-symbols-outlined icon-fill">
                  {weather.condition === 'sunny' ? 'wb_sunny' :
                   weather.condition === 'cloudy' ? 'cloud' :
                   weather.condition === 'rainy' ? 'rainy' : 'wb_sunny'}
                </span>
              </div>
              <div className="weather-temp-large">{weather.temperature}°C</div>
              <div className="weather-desc">{weather.description}</div>
            </div>
            
            <div className="weather-details-grid">
              <div className="weather-detail-card">
                <div className="detail-icon blue">
                  <span className="material-symbols-outlined">water_drop</span>
                </div>
                <div className="detail-info">
                  <div className="detail-value">{weather.humidity}%</div>
                  <div className="detail-label">Độ ẩm</div>
                </div>
              </div>
              
              <div className="weather-detail-card">
                <div className="detail-icon cyan">
                  <span className="material-symbols-outlined">air</span>
                </div>
                <div className="detail-info">
                  <div className="detail-value">{weather.windSpeed} m/s</div>
                  <div className="detail-label">Gió</div>
                </div>
              </div>
              
              <div className="weather-detail-card">
                <div className="detail-icon gray">
                  <span className="material-symbols-outlined">visibility</span>
                </div>
                <div className="detail-info">
                  <div className="detail-value">{weather.visibility} km</div>
                  <div className="detail-label">Tầm nhìn</div>
                </div>
              </div>
              
              <div className="weather-detail-card">
                <div className="detail-icon gray">
                  <span className="material-symbols-outlined">compress</span>
                </div>
                <div className="detail-info">
                  <div className="detail-value">{weather.pressure} hPa</div>
                  <div className="detail-label">Áp suất</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="weather-placeholder">
            <div className="weather-icon-large">
              <span className="material-symbols-outlined">wb_sunny</span>
            </div>
            <h4>Dự báo thời tiết</h4>
            <p>Đang tải thông tin thời tiết...</p>
            <div className="weather-note">
              <div className="note-item">
                <span className="material-symbols-outlined">build</span>
                <span>Tích hợp API thời tiết đang được phát triển</span>
              </div>
              <div className="note-item">
                <span className="material-symbols-outlined">info</span>
                <span>Sẽ hiển thị: nhiệt độ, độ ẩm, gió, ánh sáng, dự báo 7 ngày</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GardenView;