import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Grid,
  Alert
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search,
  LocationOn,
  DeviceHub
} from '@mui/icons-material';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';

function DeviceManagement() {
  const [devices, setDevices] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { socket } = useSocket();

  const [formData, setFormData] = useState({
    deviceId: '',
    name: '',
    type: 'esp32',
    ownerId: '',
    location: {
      address: ''
    },
    specifications: {
      model: '',
      version: '',
      capabilities: []
    }
  });

  useEffect(() => {
    fetchDevices();
    fetchManagers();

    // Listen for real-time device updates
    if (socket) {
      socket.on('device-management-update', (deviceData) => {
        fetchDevices(); // Refresh the list
      });
    }

    return () => {
      if (socket) {
        socket.off('device-management-update');
      }
    };
  }, [socket, searchTerm, statusFilter]);

  const fetchDevices = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await axios.get(`/api/devices?${params.toString()}`);
      setDevices(response.data.devices);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      toast.error('Không thể tải danh sách thiết bị');
    } finally {
      setLoading(false);
    }
  };

  const fetchManagers = async () => {
    try {
      const response = await axios.get('/api/users?role=manager');
      setManagers(response.data.users);
    } catch (error) {
      console.error('Failed to fetch managers:', error);
    }
  };

  const handleOpenDialog = (device = null) => {
    if (device) {
      setEditingDevice(device);
      setFormData({
        deviceId: device.deviceId,
        name: device.name,
        type: device.type,
        ownerId: device.ownerId._id,
        location: {
          address: device.location?.address || ''
        },
        specifications: {
          model: device.specifications?.model || '',
          version: device.specifications?.version || '',
          capabilities: device.specifications?.capabilities || []
        }
      });
    } else {
      setEditingDevice(null);
      setFormData({
        deviceId: '',
        name: '',
        type: 'esp32',
        ownerId: '',
        location: {
          address: ''
        },
        specifications: {
          model: '',
          version: '',
          capabilities: []
        }
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingDevice(null);
  };

  const handleSubmit = async () => {
    try {
      const submitData = {
        ...formData,
        location: {
          address: formData.location.address
        }
      };

      if (editingDevice) {
        // Update device
        await axios.put(`/api/devices/${editingDevice._id}`, submitData);
        toast.success('Cập nhật thiết bị thành công');
      } else {
        // Create new device
        await axios.post('/api/devices', submitData);
        toast.success('Tạo thiết bị thành công');
      }
      
      handleCloseDialog();
      fetchDevices();
    } catch (error) {
      console.error('Failed to save device:', error);
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const handleDelete = async (deviceId) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa thiết bị này?')) {
      try {
        await axios.delete(`/api/devices/${deviceId}`);
        toast.success('Xóa thiết bị thành công');
        fetchDevices();
      } catch (error) {
        console.error('Failed to delete device:', error);
        toast.error('Không thể xóa thiết bị');
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'success';
      case 'offline': return 'error';
      case 'maintenance': return 'warning';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'online': return 'Trực tuyến';
      case 'offline': return 'Ngoại tuyến';
      case 'maintenance': return 'Bảo trì';
      default: return status;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Quản lý thiết bị
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Thêm thiết bị
        </Button>
      </Box>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Tìm kiếm theo ID, tên thiết bị..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Trạng thái</InputLabel>
                <Select
                  value={statusFilter}
                  label="Trạng thái"
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="all">Tất cả</MenuItem>
                  <MenuItem value="online">Trực tuyến</MenuItem>
                  <MenuItem value="offline">Ngoại tuyến</MenuItem>
                  <MenuItem value="maintenance">Bảo trì</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Devices Table */}
      <Card>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Device ID</TableCell>
                <TableCell>Tên thiết bị</TableCell>
                <TableCell>Loại</TableCell>
                <TableCell>Chủ sở hữu</TableCell>
                <TableCell>Vị trí</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell>Lần cuối online</TableCell>
                <TableCell align="center">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device._id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <DeviceHub sx={{ mr: 1, color: 'primary.main' }} />
                      {device.deviceId}
                    </Box>
                  </TableCell>
                  <TableCell>{device.name}</TableCell>
                  <TableCell sx={{ textTransform: 'uppercase' }}>{device.type}</TableCell>
                  <TableCell>{device.ownerId?.fullName}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <LocationOn sx={{ mr: 1, color: 'text.secondary', fontSize: 16 }} />
                      {device.location.address}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(device.status)}
                      color={getStatusColor(device.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {device.lastSeen ? new Date(device.lastSeen).toLocaleString('vi-VN') : 'Chưa có'}
                  </TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(device)}
                      color="primary"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(device._id)}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingDevice ? 'Chỉnh sửa thiết bị' : 'Thêm thiết bị mới'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Device ID"
                value={formData.deviceId}
                onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                disabled={editingDevice}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Tên thiết bị"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Loại thiết bị</InputLabel>
                <Select
                  value={formData.type}
                  label="Loại thiết bị"
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <MenuItem value="esp32">ESP32</MenuItem>
                  <MenuItem value="sensor">Sensor</MenuItem>
                  <MenuItem value="actuator">Actuator</MenuItem>
                  <MenuItem value="camera">Camera</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Chủ sở hữu</InputLabel>
                <Select
                  value={formData.ownerId}
                  label="Chủ sở hữu"
                  onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                >
                  {managers.map((manager) => (
                    <MenuItem key={manager._id} value={manager._id}>
                      {manager.fullName} ({manager.username})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Model"
                value={formData.specifications.model}
                onChange={(e) => setFormData({
                  ...formData,
                  specifications: { ...formData.specifications, model: e.target.value }
                })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Địa chỉ"
                multiline
                rows={2}
                value={formData.location.address}
                onChange={(e) => setFormData({
                  ...formData,
                  location: { ...formData.location, address: e.target.value }
                })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Hủy</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingDevice ? 'Cập nhật' : 'Tạo mới'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DeviceManagement;