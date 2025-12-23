import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import config from '../config';
import './PlantManagement.css';

const API_BASE = config.API_BASE_URL;

const PlantManagement = () => {
  const [plants, setPlants] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [newPlant, setNewPlant] = useState({
    name: '',
    type: 'vegetable',
    variety: '',
    deviceId: '',
    plantedDate: new Date().toISOString().split('T')[0],
    expectedHarvestDate: '',
    location: '',
    optimalConditions: {
      temperature: { min: 20, max: 30 },
      humidity: { min: 60, max: 80 },
      light: { min: 40, max: 80 }
    }
  });

  useEffect(() => {
    fetchPlants();
    fetchDevices();
  }, []);

  const fetchPlants = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/plants/my-plants`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPlants(data.plants || []);
      } else {
        toast.error('Không thể tải danh sách cây trồng');
      }
    } catch (error) {
      console.error('Failed to fetch plants:', error);
      toast.error('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

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
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  };

  const handleCreatePlant = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/api/plants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newPlant)
      });

      if (response.ok) {
        setOpenDialog(false);
        setNewPlant({
          name: '',
          type: 'vegetable',
          variety: '',
          deviceId: '',
          plantedDate: new Date().toISOString().split('T')[0],
          expectedHarvestDate: '',
          location: '',
          optimalConditions: {
            temperature: { min: 20, max: 30 },
            humidity: { min: 60, max: 80 },
            light: { min: 40, max: 80 }
          }
        });
        fetchPlants();
        toast.success('Thêm cây trồng thành công!');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Thêm cây trồng thất bại');
      }
    } catch (error) {
      console.error('Create plant error:', error);
      toast.error('Lỗi kết nối server');
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

  const getGrowthStage = (progress) => {
    if (progress < 10) return { stage: 'Hạt giống', color: 'default' };
    if (progress < 25) return { stage: 'Nảy mầm', color: 'success' };
    if (progress < 50) return { stage: 'Cây con', color: 'success' };
    if (progress < 75) return { stage: 'Phát triển', color: 'primary' };
    if (progress < 90) return { stage: 'Ra hoa', color: 'warning' };
    if (progress < 100) return { stage: 'Kết quả', color: 'warning' };
    return { stage: 'Thu hoạch', color: 'error' };
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
      case 'vegetable': return 'green';
      case 'fruit': return 'red';
      case 'herb': return 'green';
      case 'flower': return 'orange';
      default: return 'green';
    }
  };

  if (loading) {
    return (
      <div className="plants-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="plants-container">
      {/* Header */}
      <div className="plants-header">
        <div className="header-text">
          <h2 className="plants-title">Quản lý cây trồng</h2>
          <p className="plants-subtitle">Theo dõi và quản lý cây trồng của bạn</p>
        </div>
        <button
          className={`add-plant-button ${devices.length === 0 ? 'disabled' : ''}`}
          onClick={() => setOpenDialog(true)}
          disabled={devices.length === 0}
        >
          <span className="material-symbols-outlined">add</span>
          Thêm cây trồng
        </button>
      </div>

      {/* Warning if no devices */}
      {devices.length === 0 && (
        <div className="warning-card">
          <div className="warning-icon">
            <span className="material-symbols-outlined">warning</span>
          </div>
          <div className="warning-content">
            <h3>Chưa có thiết bị</h3>
            <p>Bạn chưa có thiết bị nào được gán. Liên hệ Manager để được cấp thiết bị ESP32.</p>
          </div>
        </div>
      )}

      {/* Plants nearing harvest */}
      {plants.filter(plant => {
        const progress = calculateGrowthProgress(plant.plantedDate, plant.expectedHarvestDate);
        return progress >= 80 && progress < 100;
      }).length > 0 && (
        <div className="harvest-ready-section">
          <div className="harvest-ready-header">
            <h3 className="harvest-ready-title">🎯 Cây sắp thu hoạch (≥80%)</h3>
          </div>
          <div className="harvest-ready-grid">
            {plants.filter(plant => {
              const progress = calculateGrowthProgress(plant.plantedDate, plant.expectedHarvestDate);
              return progress >= 80 && progress < 100;
            }).map(plant => {
              const progress = calculateGrowthProgress(plant.plantedDate, plant.expectedHarvestDate);
              const stage = getGrowthStage(progress);
              const color = getPlantColor(plant.type);
              
              return (
                <div key={plant._id} className="harvest-ready-card">
                  <div className="harvest-card-header">
                    <div className={`harvest-card-icon ${color}`}>
                      <span className="material-symbols-outlined icon-fill">
                        {getPlantIcon(plant.type)}
                      </span>
                    </div>
                    <div className="harvest-card-info">
                      <h4 className="harvest-card-name">{plant.name}</h4>
                      <p className="harvest-card-variety">{plant.variety}</p>
                    </div>
                    <div className="harvest-card-progress">
                      <span className="progress-percentage">{progress}%</span>
                    </div>
                  </div>
                  
                  <div className="harvest-progress-bar">
                    <div 
                      className="harvest-progress-fill warning" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  
                  <div className="harvest-card-footer">
                    <span className="harvest-expected">
                      Dự kiến: {new Date(plant.expectedHarvestDate).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All Plants */}
      {plants.length === 0 ? (
        <div className="empty-plants">
          <div className="empty-plants-icon">
            <span className="material-symbols-outlined">eco</span>
          </div>
          <div className="empty-plants-content">
            <h3>Chưa có cây trồng nào</h3>
            <p>Hãy thêm cây trồng đầu tiên để bắt đầu theo dõi!</p>
            {devices.length > 0 && (
              <button
                className="add-plant-button"
                onClick={() => setOpenDialog(true)}
              >
                <span className="material-symbols-outlined">add</span>
                Thêm cây trồng
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="plants-grid">
          {plants.map(plant => {
            const progress = calculateGrowthProgress(plant.plantedDate, plant.expectedHarvestDate);
            const stage = getGrowthStage(progress);
            const color = getPlantColor(plant.type);
            
            return (
              <div key={plant._id} className="plant-card">
                <div className="plant-card-header">
                  <div className={`plant-card-icon ${color}`}>
                    <span className="material-symbols-outlined icon-fill">
                      {getPlantIcon(plant.type)}
                    </span>
                  </div>
                  <div className="plant-card-info">
                    <h4 className="plant-card-name">{plant.name}</h4>
                    <p className="plant-card-type">{plant.type} - {plant.variety}</p>
                  </div>
                </div>
                
                <div className="plant-card-device">
                  <span className="device-label">Thiết bị:</span>
                  <span className="device-name">{plant.deviceId?.name || 'N/A'}</span>
                  <span className="device-id">{plant.deviceId?.deviceId}</span>
                </div>
                
                <div className="plant-card-progress">
                  <div className="progress-header">
                    <span className={`stage-badge ${stage.color}`}>{stage.stage}</span>
                    <span className="progress-percentage">{progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className={`progress-fill ${stage.color}`}
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="plant-card-dates">
                  <div className="date-item">
                    <span className="date-label">Ngày trồng:</span>
                    <span className="date-value">{new Date(plant.plantedDate).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <div className="date-item">
                    <span className="date-label">Dự kiến thu hoạch:</span>
                    <span className="date-value">{new Date(plant.expectedHarvestDate).toLocaleDateString('vi-VN')}</span>
                  </div>
                  {plant.location && (
                    <div className="date-item">
                      <span className="date-label">Vị trí:</span>
                      <span className="date-value">{plant.location}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Plant Dialog */}
      {openDialog && (
        <div className="dialog-overlay" onClick={() => setOpenDialog(false)}>
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 className="dialog-title">Thêm cây trồng mới</h3>
              <button 
                className="dialog-close"
                onClick={() => setOpenDialog(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleCreatePlant} className="plant-form">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Tên cây</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newPlant.name}
                    onChange={(e) => setNewPlant({...newPlant, name: e.target.value})}
                    placeholder="VD: Cà chua bi"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Loại cây</label>
                  <select
                    className="form-select"
                    value={newPlant.type}
                    onChange={(e) => setNewPlant({...newPlant, type: e.target.value})}
                    required
                  >
                    <option value="vegetable">🥬 Rau củ</option>
                    <option value="fruit">🍅 Trái cây</option>
                    <option value="herb">🌿 Thảo mộc</option>
                    <option value="flower">🌸 Hoa</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Giống</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newPlant.variety}
                    onChange={(e) => setNewPlant({...newPlant, variety: e.target.value})}
                    placeholder="VD: Cherry, Roma, ..."
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Thiết bị</label>
                  <select
                    className="form-select"
                    value={newPlant.deviceId}
                    onChange={(e) => setNewPlant({...newPlant, deviceId: e.target.value})}
                    required
                  >
                    <option value="">Chọn thiết bị</option>
                    {devices.map(device => (
                      <option key={device._id} value={device._id}>
                        {device.name} ({device.deviceId})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Ngày trồng</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newPlant.plantedDate}
                    onChange={(e) => setNewPlant({...newPlant, plantedDate: e.target.value})}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Dự kiến thu hoạch</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newPlant.expectedHarvestDate}
                    onChange={(e) => setNewPlant({...newPlant, expectedHarvestDate: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="form-group full-width">
                <label className="form-label">Vị trí</label>
                <input
                  type="text"
                  className="form-input"
                  value={newPlant.location}
                  onChange={(e) => setNewPlant({...newPlant, location: e.target.value})}
                  placeholder="VD: Khu A, Hàng 1, Vị trí 3"
                />
              </div>
              
              <div className="dialog-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setOpenDialog(false)}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={!newPlant.name || !newPlant.deviceId || !newPlant.expectedHarvestDate}
                >
                  Thêm cây trồng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantManagement;