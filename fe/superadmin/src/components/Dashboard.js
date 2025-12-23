import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress
} from '@mui/material';
import {
  People,
  DeviceHub,
  CheckCircle,
  Cancel
} from '@mui/icons-material';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';

function StatCard({ title, value, icon, color, subtitle }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography color="textSecondary" gutterBottom variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', color }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              backgroundColor: `${color}20`,
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {React.cloneElement(icon, { sx: { fontSize: 40, color } })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const [stats, setStats] = useState({
    users: { total: 0, active: 0, byRole: [] },
    devices: { total: 0, online: 0, offline: 0 }
  });
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  useEffect(() => {
    fetchStats();

    // Listen for real-time updates
    if (socket) {
      socket.on('user-update', () => {
        fetchStats();
      });

      socket.on('device-management-update', () => {
        fetchStats();
      });
    }

    return () => {
      if (socket) {
        socket.off('user-update');
        socket.off('device-management-update');
      }
    };
  }, [socket]);

  const fetchStats = async () => {
    try {
      const [usersRes, devicesRes] = await Promise.all([
        axios.get('/api/users/stats'),
        axios.get('/api/devices/stats/overview')
      ]);

      setStats({
        users: usersRes.data,
        devices: devicesRes.data
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        {/* User Statistics */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Tổng người dùng"
            value={stats.users.totalUsers}
            icon={<People />}
            color="#2e7d32"
            subtitle={`${stats.users.activeUsers} đang hoạt động`}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Người dùng hoạt động"
            value={stats.users.activeUsers}
            icon={<CheckCircle />}
            color="#1976d2"
          />
        </Grid>

        {/* Device Statistics */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Tổng thiết bị"
            value={stats.devices.totalDevices}
            icon={<DeviceHub />}
            color="#ed6c02"
            subtitle={`${stats.devices.onlineDevices} đang online`}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Thiết bị offline"
            value={stats.devices.offlineDevices}
            icon={<Cancel />}
            color="#d32f2f"
          />
        </Grid>

        {/* User by Role */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Người dùng theo vai trò
              </Typography>
              <Box sx={{ mt: 2 }}>
                {stats.users.usersByRole.map((role) => (
                  <Box
                    key={role._id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 1,
                      borderBottom: '1px solid #eee'
                    }}
                  >
                    <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                      {role._id === 'superadmin' ? 'Super Admin' : role._id === 'manager' ? 'Manager' : 'User'}
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {role.count}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Device by Type */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Thiết bị theo loại
              </Typography>
              <Box sx={{ mt: 2 }}>
                {stats.devices.devicesByType.map((type) => (
                  <Box
                    key={type._id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 1,
                      borderBottom: '1px solid #eee'
                    }}
                  >
                    <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                      {type._id}
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {type.count}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Users */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Người dùng mới nhất
              </Typography>
              <Box sx={{ mt: 2 }}>
                {stats.users.recentUsers?.map((user) => (
                  <Box
                    key={user._id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 1.5,
                      borderBottom: '1px solid #eee'
                    }}
                  >
                    <Box>
                      <Typography variant="body1">{user.fullName}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        @{user.username} • {user.role}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="textSecondary">
                      {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Devices */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Thiết bị mới nhất
              </Typography>
              <Box sx={{ mt: 2 }}>
                {stats.devices.recentDevices?.map((device) => (
                  <Box
                    key={device._id}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      py: 1.5,
                      borderBottom: '1px solid #eee'
                    }}
                  >
                    <Box>
                      <Typography variant="body1">{device.name}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        ID: {device.deviceId}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Box
                        sx={{
                          display: 'inline-block',
                          px: 1,
                          py: 0.5,
                          borderRadius: 1,
                          backgroundColor: device.status === 'online' ? '#4caf5020' : '#f4433620',
                          color: device.status === 'online' ? '#4caf50' : '#f44336'
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                          {device.status}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;