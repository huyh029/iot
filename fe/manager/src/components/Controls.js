import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  IconButton
} from '@mui/material';
import {
  Add,
  LightMode,
  WaterDrop,
  Air,
  LocalFireDepartment,
  AcUnit,
  Settings,
  PlayArrow,
  Stop,
  Warning,
  Email
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import config from '../config';

const API_BASE = config.API_BASE_URL;

function Controls() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [controls, setControls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  
  const [newControl, setNewControl] = useState({
    controlType: 'light',
    mode: 'manual',
    manualSettings: { intensity: 50, duration: 0 },
    autoSettings: { targetValue: 50, tolerance: 5 },
    thresholdSettings: { 
      condition: 'above', 
      value: 30, 
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
      fetchControls(selectedDevice);
    }
  }, [selectedDevice]);

  const fetchDevices = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/devices`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
        if (data.devices?.length > 0) {
          setSelectedDevice(data.devices[0]._id);
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

  const handleCreateControl = async () => {
    try {
      // Nếu mode là threshold, gọi API reminders
      if (newControl.mode === 'threshold') {
        const response = await fetch(`${API_BASE}/api/reminders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            deviceId: selectedDevice,
            sensorType: newControl.thresholdSettings.sensorType,
            condition: newControl.thresholdSettings.condition,
            value: newControl.thresholdSettings.value,
            enabled: true,
            emailNotification: newControl.thresholdSettings.notifications?.enabled,
            cooldown: newControl.thresholdSettings.notifications?.cooldown || 5
          })
        });

        if (response.ok) {
          setOpenDialog(false);
          toast.success('Tạo nhắc nhở thành công!');
          resetNewControl();
        } else {
          const error = await response.json();
          toast.error(error.message || 'Tạo nhắc nhở thất bại');
        }
      } else {
        // Các mode khác vẫn gọi API controls
        const response = await fetch(`${API_BASE}/api/controls`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            deviceId: selectedDevice,
            ...newControl
          })
        });

        if (response.ok) {
          setOpenDialog(false);
          fetchControls(selectedDevice);
          toast.success('Tạo điều khiển thành công!');
          resetNewControl();
        } else {
          const error = await response.json();
          toast.error(error.message || 'Tạo điều khiển thất bại');
        }
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
        }
      });

      if (response.ok) {
        fetchControls(selectedDevice);
        toast.success(`${action === 'activate' ? 'Bật' : 'Tắt'} thành công!`);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Thao tác thất bại');
      }
    } catch (error) {
      toast.error('Lỗi kết nối server');
    }
  };

  const resetNewControl = () => {
    setNewControl({
      controlType: 'light',
      mode: 'manual',
      manualSettings: { intensity: 50, duration: 0 },
      autoSettings: { targetValue: 50, tolerance: 5 },
      thresholdSettings: { 
        condition: 'above', 
        value: 30, 
        sensorType: 'temperature',
        notifications: {
          enabled: true,
          methods: ['email'],
          cooldown: 5
        }
      }
    });
  };

  const getControlIcon = (type) => {
    switch (type) {
      case 'light': return <LightMode />;
      case 'water': return <WaterDrop />;
      case 'fan': return <Air />;
      case 'heater': return <LocalFireDepartment />;
      case 'cooler': return <AcUnit />;
      default: return <Settings />;
    }
  };

  const getControlColor = (type) => {
    switch (type) {
      case 'light': return '#f59e0b';
      case 'water': return '#3b82f6';
      case 'fan': return '#06b6d4';
      case 'heater': return '#ef4444';
      case 'cooler': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress sx={{ color: '#4cbe00' }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Điều khiển thiết bị
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Chọn thiết bị</InputLabel>
            <Select
              value={selectedDevice}
              label="Chọn thiết bị"
              onChange={(e) => setSelectedDevice(e.target.value)}
            >
              {devices.map(device => (
                <MenuItem key={device._id} value={device._id}>
                  {device.name} ({device.deviceId})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setOpenDialog(true)}
            disabled={!selectedDevice}
            sx={{ bgcolor: '#4cbe00', '&:hover': { bgcolor: '#3da600' } }}
          >
            Thêm điều khiển
          </Button>
        </Box>
      </Box>

      {devices.length === 0 ? (
        <Alert severity="warning">Chưa có thiết bị nào. Hãy thêm thiết bị trước.</Alert>
      ) : controls.length === 0 ? (
        <Alert severity="info">Chưa có điều khiển nào cho thiết bị này.</Alert>
      ) : (
        <Grid container spacing={3}>
          {controls.map(control => (
            <Grid item xs={12} sm={6} md={4} key={control._id}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ 
                        p: 1, 
                        borderRadius: 2, 
                        bgcolor: `${getControlColor(control.controlType)}20`,
                        color: getControlColor(control.controlType)
                      }}>
                        {getControlIcon(control.controlType)}
                      </Box>
                      <Box>
                        <Typography variant="h6" sx={{ textTransform: 'uppercase' }}>
                          {control.controlType}
                        </Typography>
                        <Chip 
                          label={control.mode} 
                          size="small" 
                          sx={{ fontSize: '0.7rem' }}
                        />
                      </Box>
                    </Box>
                    <Chip 
                      label={control.status === 'active' ? 'Đang bật' : 'Tắt'}
                      color={control.status === 'active' ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>

                  {control.mode === 'threshold' && (
                    <Box sx={{ mb: 2, p: 1.5, bgcolor: '#fff3cd', borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <Warning sx={{ fontSize: 16, color: '#856404' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#856404' }}>
                          Cảnh báo ngưỡng
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {control.thresholdSettings?.sensorType}: {' '}
                        {control.thresholdSettings?.condition === 'above' ? '>' : '<'} {' '}
                        {control.thresholdSettings?.value}
                      </Typography>
                      {control.thresholdSettings?.notifications?.enabled && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                          <Email sx={{ fontSize: 14, color: '#4cbe00' }} />
                          <Typography variant="caption" color="text.secondary">
                            Thông báo email đã bật
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {control.status === 'active' ? (
                      <Button
                        fullWidth
                        variant="outlined"
                        color="error"
                        startIcon={<Stop />}
                        onClick={() => handleControlAction(control, 'deactivate')}
                      >
                        Tắt
                      </Button>
                    ) : (
                      <Button
                        fullWidth
                        variant="contained"
                        startIcon={<PlayArrow />}
                        onClick={() => handleControlAction(control, 'activate')}
                        sx={{ bgcolor: '#4cbe00', '&:hover': { bgcolor: '#3da600' } }}
                      >
                        Bật
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialog tạo điều khiển mới */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Tạo điều khiển mới</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Loại điều khiển</InputLabel>
              <Select
                value={newControl.controlType}
                label="Loại điều khiển"
                onChange={(e) => setNewControl({...newControl, controlType: e.target.value})}
              >
                <MenuItem value="light">💡 Đèn</MenuItem>
                <MenuItem value="water">💧 Tưới nước</MenuItem>
                <MenuItem value="fan">🌀 Quạt</MenuItem>
                <MenuItem value="heater">🔥 Sưởi ấm</MenuItem>
                <MenuItem value="cooler">❄️ Làm mát</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Chế độ</InputLabel>
              <Select
                value={newControl.mode}
                label="Chế độ"
                onChange={(e) => setNewControl({...newControl, mode: e.target.value})}
              >
                <MenuItem value="manual">🔧 Thủ công</MenuItem>
                <MenuItem value="auto">🤖 Tự động</MenuItem>
                <MenuItem value="threshold">⚠️ Ngưỡng cảnh báo</MenuItem>
              </Select>
            </FormControl>

            {newControl.mode === 'manual' && (
              <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>Cài đặt thủ công</Typography>
                <Typography variant="body2" gutterBottom>
                  Cường độ: {newControl.manualSettings.intensity}%
                </Typography>
                <Slider
                  value={newControl.manualSettings.intensity}
                  onChange={(e, val) => setNewControl({
                    ...newControl,
                    manualSettings: { ...newControl.manualSettings, intensity: val }
                  })}
                  sx={{ color: '#4cbe00' }}
                />
              </Box>
            )}

            {newControl.mode === 'threshold' && (
              <Box sx={{ p: 2, bgcolor: '#fff3cd', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Warning sx={{ color: '#856404' }} /> Cài đặt ngưỡng cảnh báo
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Loại cảm biến</InputLabel>
                  <Select
                    value={newControl.thresholdSettings.sensorType}
                    label="Loại cảm biến"
                    onChange={(e) => setNewControl({
                      ...newControl,
                      thresholdSettings: { ...newControl.thresholdSettings, sensorType: e.target.value }
                    })}
                  >
                    <MenuItem value="temperature">🌡️ Nhiệt độ</MenuItem>
                    <MenuItem value="humidity">💧 Độ ẩm không khí</MenuItem>
                    <MenuItem value="soil_moisture">🌱 Độ ẩm đất</MenuItem>
                    <MenuItem value="light">☀️ Ánh sáng</MenuItem>
                  </Select>
                </FormControl>

                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <FormControl sx={{ flex: 1 }}>
                    <InputLabel>Điều kiện</InputLabel>
                    <Select
                      value={newControl.thresholdSettings.condition}
                      label="Điều kiện"
                      onChange={(e) => setNewControl({
                        ...newControl,
                        thresholdSettings: { ...newControl.thresholdSettings, condition: e.target.value }
                      })}
                    >
                      <MenuItem value="above">📈 Vượt trên</MenuItem>
                      <MenuItem value="below">📉 Dưới mức</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label="Giá trị ngưỡng"
                    type="number"
                    value={newControl.thresholdSettings.value}
                    onChange={(e) => setNewControl({
                      ...newControl,
                      thresholdSettings: { ...newControl.thresholdSettings, value: parseInt(e.target.value) || 0 }
                    })}
                    sx={{ flex: 1 }}
                  />
                </Box>

                <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Email sx={{ color: '#4cbe00' }} /> Thông báo Email
                  </Typography>
                  
                  <FormControlLabel
                    control={
                      <Switch
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
                        sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#4cbe00' } }}
                      />
                    }
                    label="Bật thông báo qua Email"
                  />

                  {newControl.thresholdSettings.notifications?.enabled && (
                    <TextField
                      fullWidth
                      label="Thời gian chờ giữa các thông báo (phút)"
                      type="number"
                      size="small"
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
                      helperText="Tránh spam email khi sensor liên tục vượt ngưỡng"
                      sx={{ mt: 1 }}
                    />
                  )}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Hủy</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateControl}
            sx={{ bgcolor: '#4cbe00', '&:hover': { bgcolor: '#3da600' } }}
          >
            Tạo
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Controls;
