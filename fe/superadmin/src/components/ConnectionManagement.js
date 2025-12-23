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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Alert
} from '@mui/material';
import {
  Link,
  LinkOff,
  Search,
  DeviceHub,
  Person
} from '@mui/icons-material';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';
import toast from 'react-hot-toast';

function ConnectionManagement() {
  const [users, setUsers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const { socket } = useSocket();

  useEffect(() => {
    fetchData();

    // Listen for real-time updates
    if (socket) {
      socket.on('user-update', () => {
        fetchData();
      });
      socket.on('device-management-update', () => {
        fetchData();
      });
    }

    return () => {
      if (socket) {
        socket.off('user-update');
        socket.off('device-management-update');
      }
    };
  }, [socket, searchTerm, roleFilter]);

  const fetchData = async () => {
    try {
      const [usersRes, devicesRes] = await Promise.all([
        axios.get('/api/users'),
        axios.get('/api/devices')
      ]);

      setUsers(usersRes.data.users);
      setDevices(devicesRes.data.devices);

      // Create connections data
      const connectionsData = usersRes.data.users.map(user => ({
        user,
        assignedDevices: user.deviceIds || []
      }));
      setConnections(connectionsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user) => {
    setSelectedUser(user);
    setSelectedDevices(user.deviceIds?.map(d => d._id) || []);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedUser(null);
    setSelectedDevices([]);
  };

  const handleDeviceToggle = (deviceId) => {
    setSelectedDevices(prev => 
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const handleSaveConnections = async () => {
    try {
      await axios.post(`/api/users/${selectedUser._id}/assign-devices`, {
        deviceIds: selectedDevices
      });
      
      toast.success('Cập nhật kết nối thành công');
      handleCloseDialog();
      fetchData();
    } catch (error) {
      console.error('Failed to save connections:', error);
      toast.error(error.response?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const getAvailableDevices = () => {
    if (!selectedUser) return [];
    
    // For managers, show their own devices
    if (selectedUser.role === 'manager') {
      return devices.filter(device => device.ownerId._id === selectedUser._id);
    }
    
    // For users, show devices owned by their manager
    if (selectedUser.role === 'user' && selectedUser.managerId) {
      return devices.filter(device => device.ownerId._id === selectedUser.managerId._id);
    }
    
    // For superadmin, show all devices
    if (selectedUser.role === 'superadmin') {
      return devices;
    }
    
    return [];
  };

  const filteredConnections = connections.filter(connection => {
    const matchesSearch = !searchTerm || 
      connection.user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      connection.user.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || connection.user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const getConnectionStatus = (user) => {
    const deviceCount = user.deviceIds?.length || 0;
    if (deviceCount === 0) return { label: 'Chưa kết nối', color: 'error' };
    return { label: `${deviceCount} thiết bị`, color: 'success' };
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          Quản lý kết nối
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Quản lý việc assign thiết bị cho người dùng. Manager chỉ có thể assign thiết bị của mình cho User thuộc quyền quản lý.
      </Alert>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                placeholder="Tìm kiếm người dùng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Vai trò</InputLabel>
                <Select
                  value={roleFilter}
                  label="Vai trò"
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <MenuItem value="all">Tất cả</MenuItem>
                  <MenuItem value="manager">Manager</MenuItem>
                  <MenuItem value="user">User</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Connections Table */}
      <Card>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Người dùng</TableCell>
                <TableCell>Vai trò</TableCell>
                <TableCell>Manager</TableCell>
                <TableCell>Trạng thái kết nối</TableCell>
                <TableCell>Thiết bị được assign</TableCell>
                <TableCell align="center">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredConnections.map((connection) => {
                const status = getConnectionStatus(connection.user);
                return (
                  <TableRow key={connection.user._id}>
                    <TableCell>
                      <Box>
                        <Typography variant="body1" fontWeight="medium">
                          {connection.user.fullName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          @{connection.user.username}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={connection.user.role}
                        color={connection.user.role === 'manager' ? 'warning' : 'success'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {connection.user.managerId?.fullName || '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={status.label}
                        color={status.color}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        {connection.user.deviceIds?.slice(0, 2).map((device) => (
                          <Chip
                            key={device._id}
                            label={device.name}
                            size="small"
                            sx={{ mr: 0.5, mb: 0.5 }}
                          />
                        ))}
                        {connection.user.deviceIds?.length > 2 && (
                          <Typography variant="caption" color="text.secondary">
                            +{connection.user.deviceIds.length - 2} khác
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(connection.user)}
                        color="primary"
                      >
                        <Link />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Device Assignment Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Person sx={{ mr: 1 }} />
            Assign thiết bị cho {selectedUser?.fullName}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Chọn các thiết bị để assign cho người dùng này:
          </Typography>
          
          <List>
            {getAvailableDevices().map((device) => (
              <ListItem key={device._id} divider>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <DeviceHub sx={{ mr: 1, color: 'primary.main' }} />
                      {device.name}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="caption">
                        ID: {device.deviceId} • Chủ sở hữu: {device.ownerId.fullName}
                      </Typography>
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        {device.location.address}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Checkbox
                    checked={selectedDevices.includes(device._id)}
                    onChange={() => handleDeviceToggle(device._id)}
                  />
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
          
          {getAvailableDevices().length === 0 && (
            <Alert severity="warning">
              Không có thiết bị nào có thể assign cho người dùng này.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Hủy</Button>
          <Button 
            onClick={handleSaveConnections} 
            variant="contained"
            disabled={getAvailableDevices().length === 0}
          >
            Lưu kết nối
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ConnectionManagement;