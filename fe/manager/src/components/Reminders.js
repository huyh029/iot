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
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  NotificationsActive,
  Email,
  Warning,
  History,
  Thermostat,
  WaterDrop,
  WbSunny,
  Grass
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';
import config from '../config';

const API_BASE = config.API_BASE_URL;

function Reminders() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [reminders, setReminders] = useState([]);
  const [alertHistory, setAlertHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  
  const [newReminder, setNewReminder] = useState({
    sensorType: 'temperature',
    condition: 'above',
    value: 30,
    enabled: true,
    emailNotification: true,
    cooldown: 5
  });

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      fetchReminders(selectedDevice);
      fetchAlertHistory(selectedDevice);
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

  const fetchReminders = async (deviceId) => {
    try {
      const response = await fetch(`${API_BASE}/api/reminders/device/${deviceId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setReminders(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch reminders:', error);
    }
  };

  const fetchAlertHistory = async (deviceId) => {
    try {
      const response = await fetch(`${API_BASE}/api/reminders/device/${deviceId}/history`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAlertHistory(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch alert history:', error);
    }
  };

  const handleCreateReminder = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          deviceId: selectedDevice,
          ...newReminder
        })
      });

      if (response.ok) {
        setOpenDialog(false);
        fetchReminders(selectedDevice);
        toast.success('Tạo nhắc nhở thành công!');
        resetNewReminder();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Tạo nhắc nhở thất bại');
      }
    } catch (error) {
      console.error('Create reminder error:', error);
      toast.error('Lỗi kết nối server');
    }
  };

  const handleUpdateReminder = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/reminders/${editingReminder._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newReminder)
      });

      if (response.ok) {
        setOpenDialog(false);
        setEditingReminder(null);
        fetchReminders(selectedDevice);
        toast.success('Cập nhật nhắc nhở thành công!');
        resetNewReminder();
      } else {
        const error = await response.json();
        toast.error(error.message || 'Cập nhật thất bại');
      }
    } catch (error) {
      toast.error('Lỗi kết nối server');
    }
  };

  const handleDeleteReminder = async (reminderId) => {
    if (!window.confirm('Bạn có chắc muốn xóa nhắc nhở này?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/reminders/${reminderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        fetchReminders(selectedDevice);
        toast.success('Xóa nhắc nhở thành công!');
      } else {
        toast.error('Xóa thất bại');
      }
    } catch (error) {
      toast.error('Lỗi kết nối server');
    }
  };

  const handleToggleReminder = async (reminder) => {
    try {
      const response = await fetch(`${API_BASE}/api/reminders/${reminder._id}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        fetchReminders(selectedDevice);
        toast.success(reminder.enabled ? 'Đã tắt nhắc nhở' : 'Đã bật nhắc nhở');
      }
    } catch (error) {
      toast.error('Lỗi kết nối server');
    }
  };

  const resetNewReminder = () => {
    setNewReminder({
      sensorType: 'temperature',
      condition: 'above',
      value: 30,
      enabled: true,
      emailNotification: true,
      cooldown: 5
    });
  };

  const openEditDialog = (reminder) => {
    setEditingReminder(reminder);
    setNewReminder({
      sensorType: reminder.sensorType,
      condition: reminder.condition,
      value: reminder.value,
      enabled: reminder.enabled,
      emailNotification: reminder.emailNotification,
      cooldown: reminder.cooldown || 5
    });
    setOpenDialog(true);
  };

  const getSensorIcon = (type) => {
    switch (type) {
      case 'temperature': return <Thermostat sx={{ color: '#ef4444' }} />;
      case 'humidity': return <WaterDrop sx={{ color: '#3b82f6' }} />;
      case 'soil_moisture': return <Grass sx={{ color: '#22c55e' }} />;
      case 'light': return <WbSunny sx={{ color: '#f59e0b' }} />;
      default: return <Warning />;
    }
  };

  const getSensorLabel = (type) => {
    switch (type) {
      case 'temperature': return 'Nhiệt độ';
      case 'humidity': return 'Độ ẩm không khí';
      case 'soil_moisture': return 'Độ ẩm đất';
      case 'light': return 'Ánh sáng';
      default: return type;
    }
  };

  const getSensorUnit = (type) => {
    switch (type) {
      case 'temperature': return '°C';
      case 'humidity': return '%';
      case 'soil_moisture': return '%';
      case 'light': return 'lux';
      default: return '';
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
        <Typography variant="h4" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <NotificationsActive sx={{ color: '#4cbe00' }} />
          Nhắc nhở & Cảnh báo
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
            onClick={() => {
              setEditingReminder(null);
              resetNewReminder();
              setOpenDialog(true);
            }}
            disabled={!selectedDevice}
            sx={{ bgcolor: '#4cbe00', '&:hover': { bgcolor: '#3da600' } }}
          >
            Thêm nhắc nhở
          </Button>
        </Box>
      </Box>

      <Tabs 
        value={tabValue} 
        onChange={(e, v) => setTabValue(v)} 
        sx={{ mb: 3, '& .Mui-selected': { color: '#4cbe00' }, '& .MuiTabs-indicator': { bgcolor: '#4cbe00' } }}
      >
        <Tab icon={<NotificationsActive />} label="Danh sách nhắc nhở" />
        <Tab icon={<History />} label="Lịch sử cảnh báo" />
      </Tabs>

      {tabValue === 0 && (
        <>
          {devices.length === 0 ? (
            <Alert severity="warning">Chưa có thiết bị nào. Hãy thêm thiết bị trước.</Alert>
          ) : reminders.length === 0 ? (
            <Alert severity="info">Chưa có nhắc nhở nào cho thiết bị này. Nhấn "Thêm nhắc nhở" để tạo mới.</Alert>
          ) : (
            <Grid container spacing={3}>
              {reminders.map(reminder => (
                <Grid item xs={12} sm={6} md={4} key={reminder._id}>
                  <Card sx={{ 
                    height: '100%', 
                    opacity: reminder.enabled ? 1 : 0.6,
                    border: reminder.enabled ? '2px solid #4cbe00' : '1px solid #e0e0e0'
                  }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {getSensorIcon(reminder.sensorType)}
                          <Typography variant="h6">
                            {getSensorLabel(reminder.sensorType)}
                          </Typography>
                        </Box>
                        <Switch
                          checked={reminder.enabled}
                          onChange={() => handleToggleReminder(reminder)}
                          sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#4cbe00' } }}
                        />
                      </Box>

                      <Box sx={{ 
                        p: 2, 
                        bgcolor: '#f8fafc', 
                        borderRadius: 2, 
                        mb: 2,
                        textAlign: 'center'
                      }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Cảnh báo khi
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#0f172a' }}>
                          {reminder.condition === 'above' ? '>' : '<'} {reminder.value}{getSensorUnit(reminder.sensorType)}
                        </Typography>
                      </Box>

                      {reminder.emailNotification && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <Email sx={{ fontSize: 18, color: '#4cbe00' }} />
                          <Typography variant="body2" color="text.secondary">
                            Gửi email (chờ {reminder.cooldown || 5} phút)
                          </Typography>
                        </Box>
                      )}

                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          startIcon={<Edit />}
                          onClick={() => openEditDialog(reminder)}
                          sx={{ flex: 1 }}
                        >
                          Sửa
                        </Button>
                        <IconButton 
                          color="error" 
                          size="small"
                          onClick={() => handleDeleteReminder(reminder._id)}
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {tabValue === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell>Thời gian</TableCell>
                <TableCell>Loại cảm biến</TableCell>
                <TableCell>Giá trị</TableCell>
                <TableCell>Ngưỡng</TableCell>
                <TableCell>Trạng thái</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alertHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography color="text.secondary" sx={{ py: 3 }}>
                      Chưa có lịch sử cảnh báo
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                alertHistory.map((alert, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {new Date(alert.timestamp).toLocaleString('vi-VN')}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getSensorIcon(alert.sensorType)}
                        {getSensorLabel(alert.sensorType)}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 'bold', color: '#ef4444' }}>
                        {alert.actualValue}{getSensorUnit(alert.sensorType)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {alert.condition === 'above' ? '>' : '<'} {alert.thresholdValue}{getSensorUnit(alert.sensorType)}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={alert.emailSent ? 'Đã gửi email' : 'Chưa gửi'} 
                        color={alert.emailSent ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Dialog tạo/sửa nhắc nhở */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingReminder ? 'Sửa nhắc nhở' : 'Tạo nhắc nhở mới'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Loại cảm biến</InputLabel>
              <Select
                value={newReminder.sensorType}
                label="Loại cảm biến"
                onChange={(e) => setNewReminder({...newReminder, sensorType: e.target.value})}
              >
                <MenuItem value="temperature">🌡️ Nhiệt độ</MenuItem>
                <MenuItem value="humidity">💧 Độ ẩm không khí</MenuItem>
                <MenuItem value="soil_moisture">🌱 Độ ẩm đất</MenuItem>
                <MenuItem value="light">☀️ Ánh sáng</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Điều kiện</InputLabel>
                <Select
                  value={newReminder.condition}
                  label="Điều kiện"
                  onChange={(e) => setNewReminder({...newReminder, condition: e.target.value})}
                >
                  <MenuItem value="above">📈 Vượt trên</MenuItem>
                  <MenuItem value="below">📉 Dưới mức</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Giá trị ngưỡng"
                type="number"
                value={newReminder.value}
                onChange={(e) => setNewReminder({...newReminder, value: parseFloat(e.target.value) || 0})}
                sx={{ flex: 1 }}
                InputProps={{
                  endAdornment: <Typography color="text.secondary">{getSensorUnit(newReminder.sensorType)}</Typography>
                }}
              />
            </Box>

            <Box sx={{ p: 2, bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Email sx={{ color: '#4cbe00' }} /> Thông báo Email
              </Typography>
              
              <FormControlLabel
                control={
                  <Switch
                    checked={newReminder.emailNotification}
                    onChange={(e) => setNewReminder({...newReminder, emailNotification: e.target.checked})}
                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#4cbe00' } }}
                  />
                }
                label="Gửi email khi vượt ngưỡng"
              />

              {newReminder.emailNotification && (
                <TextField
                  fullWidth
                  label="Thời gian chờ giữa các email (phút)"
                  type="number"
                  size="small"
                  value={newReminder.cooldown}
                  onChange={(e) => setNewReminder({...newReminder, cooldown: parseInt(e.target.value) || 5})}
                  helperText="Tránh spam email khi sensor liên tục vượt ngưỡng"
                  sx={{ mt: 1 }}
                />
              )}
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={newReminder.enabled}
                  onChange={(e) => setNewReminder({...newReminder, enabled: e.target.checked})}
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#4cbe00' } }}
                />
              }
              label="Kích hoạt nhắc nhở"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Hủy</Button>
          <Button 
            variant="contained" 
            onClick={editingReminder ? handleUpdateReminder : handleCreateReminder}
            sx={{ bgcolor: '#4cbe00', '&:hover': { bgcolor: '#3da600' } }}
          >
            {editingReminder ? 'Cập nhật' : 'Tạo'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Reminders;
