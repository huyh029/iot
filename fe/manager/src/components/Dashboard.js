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
  Eco,
  CheckCircle
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
    users: { total: 0, active: 0 },
    devices: { total: 0, online: 0, offline: 0 },
    plants: { total: 0, nearHarvest: 0 }
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

      socket.on('plant-update', () => {
        fetchStats();
      });
    }

    return () => {
      if (socket) {
        socket.off('user-update');
        socket.off('device-management-update');
        socket.off('plant-update');
      }
    };
  }, [socket]);

  const fetchStats = async () => {
    try {
      const [usersRes, devicesRes, plantsRes] = await Promise.all([
        axios.get('/api/users/my-users'),
        axios.get('/api/devices/stats/overview'),
        axios.get('/api/plants/harvest/upcoming?threshold=80')
      ]);

      setStats({
        users: {
          total: usersRes.data.total || 0,
          active: usersRes.data.users?.filter(u => u.isActive).length || 0
        },
        devices: devicesRes.data,
        plants: {
          total: plantsRes.data.length || 0,
          nearHarvest: plantsRes.data.filter(p => p.growthProgress >= 80).length || 0
        }
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
        Dashboard Manager
      </Typography>

      <Grid container spacing={3}>
        {/* User Statistics */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Người dùng của tôi"
            value={stats.users.total}
            icon={<People />}
            color="#2e7d32"
            subtitle={`${stats.users.active} đang hoạt động`}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Thiết bị của tôi"
            value={stats.devices.totalDevices}
            icon={<DeviceHub />}
            color="#1976d2"
            subtitle={`${stats.devices.onlineDevices} đang online`}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Cây trồng"
            value={stats.plants.total}
            icon={<Eco />}
            color="#ed6c02"
            subtitle={`${stats.plants.nearHarvest} sắp thu hoạch`}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Thiết bị online"
            value={stats.devices.onlineDevices}
            icon={<CheckCircle />}
            color="#4caf50"
          />
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Người dùng gần đây
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Chức năng này sẽ hiển thị danh sách người dùng mới nhất
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Thiết bị gần đây
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Chức năng này sẽ hiển thị trạng thái thiết bị mới nhất
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Plants Near Harvest */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Cây trồng sắp thu hoạch
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="textSecondary">
                  Danh sách các cây trồng có tiến độ phát triển >= 80%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;