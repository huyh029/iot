import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useSocket } from '../contexts/SocketContext';
import config from '../config';
import './Controls.css';

const API_BASE = config.API_BASE_URL;

const Controls = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [controls, setControls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const { connected, sendControlCommand } = useSocket();
  
  const [newControl, setNewControl] = useState({
    controlType: 'light',
    mode: 'manual',
    manualSettings: { intensity: 50, duration: 0 },
    scheduledSettings: { 
      schedule: [{ 
        days: ['monday'], 
        startTime: '09:00', 
        endTime: '18:00', 
        intensity: 50 
      }] 
    },
    autoSettings: { targetValue: 50, tolerance: 5 },
    thresholdSettings: { 
      condition: 'above', 
      value: 80, 
      action: 'activate', 
      intensity: 100,
      sensorType: 'temperature',
      notifications: {
        enabled: true,
        methods: ['email'],
        cooldown: 5
      }
    }
  });

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      fetchControls(selectedDevice._id);
    }
  }, [selectedDevice]);

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
      toast.error('Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

  const fetchControls = async (deviceId) => {
    try {
      const response = await fetch(`${API_BASE}/api/controls/device/${deviceId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setControls(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch controls:', error);
    }
  };

  const handleCreateControl = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/api/controls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          deviceId: selectedDevice._id,
          ...newControl
        })
      });

      if (response.ok) {
        setOpenDialog(false);
        fetchControls(selectedDevice._id);
        toast.success('Tạo điều khiển thành công!');
        setNewControl({
          controlType: 'light',
          mode: 'manual',
          manualSettings: { intensity: 50, duration: 0 },
          scheduledSettings: { 
            schedule: [{ 
              days: ['monday'], 
              startTime: '09:00', 
              endTime: '18:00', 
              intensity: 50 
            }] 
          },
          autoSettings: { targetValue: 50, tolerance: 5 },
          thresholdSettings: { 
            condition: 'above', 
            value: 80, 
            action: 'activate', 
            intensity: 100,
            sensorType: 'temperature',
            notifications: {
              enabled: true,
              methods: ['email'],
              cooldown: 5
            }
          }
        });
      } else {
        const error = await response.json();
        toast.error(error.message || 'Tạo điều khiển thất bại');
      }
    } catch (error) {
      console.error('Create control error:', error);
      toast.error('Lỗi kết nối server');
    }
  };

  const handleControlAction = async (control, action) => {
    try {
      const response = await fetch(`${API_BASE}/api/controls/${control._id}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          intensity: control.manualSettings?.intensity || 50,
          duration: control.manualSettings?.duration || 0
        })
      });

      if (response.ok) {
        // Send real-time command via WebSocket
        sendControlCommand(
          selectedDevice._id,
          control.controlType,
          action,
          {
            intensity: control.manualSettings?.intensity || 50,
            duration: control.manualSettings?.duration || 0
          }
        );
        
        fetchControls(selectedDevice._id);
        toast.success(`${action === 'activate' ? 'Bật' : 'Tắt'} điều khiển thành công!`);
      } else {
        const error = await response.json();
        toast.error(error.message || `${action} thất bại`);
      }
    } catch (error) {
      console.error(`Control ${action} error:`, error);
      toast.error('Lỗi kết nối server');
    }
  };

  const getControlIcon = (type) => {
    switch (type) {
      case 'light': return 'light_mode';
      case 'water': return 'water_drop';
      case 'fan': return 'air';
      case 'heater': return 'local_fire_department';
      case 'cooler': return 'ac_unit';
      default: return 'settings';
    }
  };

  const getModeIcon = (mode) => {
    switch (mode) {
      case 'manual': return 'pan_tool';
      case 'scheduled': return 'schedule';
      case 'auto': return 'smart_toy';
      case 'threshold': return 'warning';
      default: return 'settings';
    }
  };

  const getModeDescription = (control) => {
    switch (control.mode) {
      case 'manual':
        return `Cường độ: ${control.manualSettings?.intensity || 0}% | Thời gian: ${control.manualSettings?.duration || 0} phút`;
      case 'auto':
        return `Mục tiêu: ${control.autoSettings?.targetValue || 0} ± ${control.autoSettings?.tolerance || 0}`;
      case 'threshold':
        return `${control.thresholdSettings?.condition === 'above' ? 'Trên' : 'Dưới'} ${control.thresholdSettings?.value || 0}`;
      case 'scheduled':
        return 'Theo lịch đã đặt';
      default:
        return 'Chưa cấu hình';
    }
  };

  const getControlColor = (type) => {
    switch (type) {
      case 'light': return 'yellow';
      case 'water': return 'blue';
      case 'fan': return 'cyan';
      case 'heater': return 'red';
      case 'cooler': return 'blue';
      default: return 'gray';
    }
  };

  if (loading) {
    return (
      <div className="controls-loading">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="controls-container">
        <div className="controls-header">
          <div className="header-text">
            <h2 className="controls-title">Điều khiển thiết bị</h2>
            <p className="controls-subtitle">Quản lý và điều khiển các thiết bị IoT</p>
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
    <div className="controls-container">
      {/* Header */}
      <div className="controls-header">
        <div className="header-text">
          <h2 className="controls-title">Điều khiển thiết bị</h2>
          <p className="controls-subtitle">Quản lý và điều khiển các thiết bị IoT</p>
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
          <button
            className="add-control-button"
            onClick={() => setOpenDialog(true)}
          >
            <span className="material-symbols-outlined">add</span>
            Thêm điều khiển
          </button>
        </div>
      </div>

      {/* Device Status */}
      {selectedDevice && (
        <div className="device-status-card">
          <div className="device-status-header">
            <div className="device-info">
              <h3 className="device-name">{selectedDevice.name}</h3>
              <p className="device-id">ID: {selectedDevice.deviceId}</p>
            </div>
            <div className="device-badges">
              <span className={`device-badge ${selectedDevice.status}`}>
                <span className="material-symbols-outlined">
                  {selectedDevice.status === 'online' ? 'wifi' : 
                   selectedDevice.status === 'offline' ? 'wifi_off' : 'build'}
                </span>
                {selectedDevice.status === 'online' ? 'Trực tuyến' : 
                 selectedDevice.status === 'offline' ? 'Ngoại tuyến' : 'Bảo trì'}
              </span>
              <span className={`connection-badge ${connected ? 'connected' : 'disconnected'}`}>
                <span className="material-symbols-outlined">
                  {connected ? 'sync' : 'sync_disabled'}
                </span>
                {connected ? 'Real-time' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Controls Grid */}
      {controls.length === 0 ? (
        <div className="empty-controls">
          <div className="empty-controls-icon">
            <span className="material-symbols-outlined">settings</span>
          </div>
          <div className="empty-controls-content">
            <h3>Chưa có điều khiển nào</h3>
            <p>Hãy thêm điều khiển đầu tiên cho thiết bị này!</p>
            <button
              className="add-control-button"
              onClick={() => setOpenDialog(true)}
            >
              <span className="material-symbols-outlined">add</span>
              Thêm điều khiển
            </button>
          </div>
        </div>
      ) : (
        <div className="controls-grid">
          {controls.map(control => (
            <ControlCard 
              key={control._id} 
              control={control} 
              onAction={handleControlAction}
              getControlIcon={getControlIcon}
              getModeIcon={getModeIcon}
              getModeDescription={getModeDescription}
              getControlColor={getControlColor}
            />
          ))}
        </div>
      )}

      {/* Add Control Dialog */}
      {openDialog && (
        <div className="dialog-overlay" onClick={() => setOpenDialog(false)}>
          <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 className="dialog-title">Tạo điều khiển mới</h3>
              <button 
                className="dialog-close"
                onClick={() => setOpenDialog(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleCreateControl} className="control-form">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Loại điều khiển</label>
                  <select
                    className="form-select"
                    value={newControl.controlType}
                    onChange={(e) => setNewControl({...newControl, controlType: e.target.value})}
                  >
                    <option value="light">💡 Đèn</option>
                    <option value="water">💧 Tưới nước</option>
                    <option value="fan">🌀 Quạt</option>
                    <option value="heater">🔥 Sưởi ấm</option>
                    <option value="cooler">❄️ Làm mát</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Chế độ</label>
                  <select
                    className="form-select"
                    value={newControl.mode}
                    onChange={(e) => setNewControl({...newControl, mode: e.target.value})}
                  >
                    <option value="manual">🔧 Thủ công</option>
                    <option value="scheduled">⏰ Hẹn giờ</option>
                    <option value="auto">🤖 Tự động</option>
                    <option value="threshold">⚠️ Ngưỡng</option>
                  </select>
                </div>
              </div>

              {/* Manual Settings */}
              {newControl.mode === 'manual' && (
                <div className="mode-settings">
                  <h4 className="settings-title">Cài đặt thủ công</h4>
                  <div className="form-group">
                    <label className="form-label">
                      Cường độ: {newControl.manualSettings.intensity}%
                    </label>
                    <input
                      type="range"
                      className="range-slider"
                      min="0"
                      max="100"
                      value={newControl.manualSettings.intensity}
                      onChange={(e) => setNewControl({
                        ...newControl,
                        manualSettings: { ...newControl.manualSettings, intensity: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Thời gian (phút, 0 = không giới hạn)</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      value={newControl.manualSettings.duration}
                      onChange={(e) => setNewControl({
                        ...newControl,
                        manualSettings: { ...newControl.manualSettings, duration: parseInt(e.target.value) || 0 }
                      })}
                    />
                  </div>
                </div>
              )}

              {/* Auto Settings */}
              {newControl.mode === 'auto' && (
                <div className="mode-settings">
                  <h4 className="settings-title">Cài đặt tự động</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Giá trị mục tiêu</label>
                      <input
                        type="number"
                        className="form-input"
                        value={newControl.autoSettings.targetValue}
                        onChange={(e) => setNewControl({
                          ...newControl,
                          autoSettings: { ...newControl.autoSettings, targetValue: parseInt(e.target.value) || 0 }
                        })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Dung sai (±)</label>
                      <input
                        type="number"
                        className="form-input"
                        value={newControl.autoSettings.tolerance}
                        onChange={(e) => setNewControl({
                          ...newControl,
                          autoSettings: { ...newControl.autoSettings, tolerance: parseInt(e.target.value) || 0 }
                        })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Threshold Settings */}
              {newControl.mode === 'threshold' && (
                <div className="mode-settings">
                  <h4 className="settings-title">Cài đặt ngưỡng cảnh báo</h4>
                  
                  <div className="form-group">
                    <label className="form-label">Loại cảm biến</label>
                    <select
                      className="form-select"
                      value={newControl.thresholdSettings.sensorType}
                      onChange={(e) => setNewControl({
                        ...newControl,
                        thresholdSettings: { ...newControl.thresholdSettings, sensorType: e.target.value }
                      })}
                    >
                      <option value="temperature">🌡️ Nhiệt độ</option>
                      <option value="humidity">💧 Độ ẩm không khí</option>
                      <option value="soil_moisture">🌱 Độ ẩm đất</option>
                      <option value="light">☀️ Ánh sáng</option>
                    </select>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Điều kiện</label>
                      <select
                        className="form-select"
                        value={newControl.thresholdSettings.condition}
                        onChange={(e) => setNewControl({
                          ...newControl,
                          thresholdSettings: { ...newControl.thresholdSettings, condition: e.target.value }
                        })}
                      >
                        <option value="above">📈 Vượt trên</option>
                        <option value="below">📉 Dưới mức</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Giá trị ngưỡng</label>
                      <input
                        type="number"
                        className="form-input"
                        value={newControl.thresholdSettings.value}
                        onChange={(e) => setNewControl({
                          ...newControl,
                          thresholdSettings: { ...newControl.thresholdSettings, value: parseInt(e.target.value) || 0 }
                        })}
                      />
                    </div>
                  </div>

                  <div className="notification-settings">
                    <h5 className="settings-subtitle">📧 Cài đặt thông báo</h5>
                    
                    <div className="form-group checkbox-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={newControl.thresholdSettings.notifications?.enabled}
                          onChange={(e) => setNewControl({
                            ...newControl,
                            thresholdSettings: { 
                              ...newControl.thresholdSettings, 
                              notifications: {
                                ...newControl.thresholdSettings.notifications,
                                enabled: e.target.checked
                              }
                            }
                          })}
                        />
                        <span className="checkmark"></span>
                        Bật thông báo qua Email
                      </label>
                    </div>

                    {newControl.thresholdSettings.notifications?.enabled && (
                      <div className="form-group">
                        <label className="form-label">Thời gian chờ giữa các thông báo (phút)</label>
                        <input
                          type="number"
                          className="form-input"
                          min="1"
                          max="60"
                          value={newControl.thresholdSettings.notifications?.cooldown || 5}
                          onChange={(e) => setNewControl({
                            ...newControl,
                            thresholdSettings: { 
                              ...newControl.thresholdSettings, 
                              notifications: {
                                ...newControl.thresholdSettings.notifications,
                                cooldown: parseInt(e.target.value) || 5
                              }
                            }
                          })}
                        />
                        <small className="form-hint">Tránh spam email khi sensor liên tục vượt ngưỡng</small>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="dialog-actions">
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setOpenDialog(false)}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary">
                  Tạo điều khiển
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Control Card Component
const ControlCard = ({ control, onAction, getControlIcon, getModeIcon, getModeDescription, getControlColor }) => {
  const color = getControlColor(control.controlType);
  
  return (
    <div className="control-card">
      <div className="control-card-header">
        <div className="control-card-icon-wrapper">
          <div className={`control-card-icon ${color}`}>
            <span className="material-symbols-outlined icon-fill">
              {getControlIcon(control.controlType)}
            </span>
          </div>
          <div className="control-card-info">
            <h4 className="control-card-name">
              {control.controlType.toUpperCase()}
            </h4>
            <p className="control-card-mode">
              <span className="material-symbols-outlined mode-icon">
                {getModeIcon(control.mode)}
              </span>
              {control.mode.toUpperCase()}
            </p>
          </div>
        </div>
        <span className={`control-status-badge ${control.status}`}>
          {control.status === 'active' ? 'Đang hoạt động' : 'Tắt'}
        </span>
      </div>

      <div className="control-card-description">
        <p className="control-description-text">
          {getModeDescription(control)}
        </p>
      </div>

      {control.currentState && (
        <div className="control-card-state">
          <div className="state-item">
            <span className="state-label">Cường độ hiện tại:</span>
            <span className="state-value">{control.currentState.intensity || 0}%</span>
          </div>
          {control.currentState.lastActivated && (
            <div className="state-item">
              <span className="state-label">Lần cuối:</span>
              <span className="state-value">
                {new Date(control.currentState.lastActivated).toLocaleString('vi-VN')}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="control-card-actions">
        {control.status === 'active' ? (
          <button
            className="control-action-button stop"
            onClick={() => onAction(control, 'deactivate')}
          >
            <span className="material-symbols-outlined">stop</span>
            Tắt
          </button>
        ) : (
          <button
            className="control-action-button start"
            onClick={() => onAction(control, 'activate')}
          >
            <span className="material-symbols-outlined">play_arrow</span>
            Bật
          </button>
        )}
      </div>
    </div>
  );
};

export default Controls;