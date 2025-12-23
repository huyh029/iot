import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  LinearProgress,
  Chip,
  Alert
} from '@mui/material';
import {
  Eco,
  Schedule,
  TrendingUp
} from '@mui/icons-material';
import axios from 'axios';
import { useSocket } from '../contexts/SocketContext';

function PlantManagement() {
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  useEffect(() => {
    fetchPlants();

    // Listen for real-time plant updates
    if (socket) {
      socket.on('plant-update', () => {
        fetchPlants();
      });
    }

    return () => {
      if (socket) {
        socket.off('plant-update');
      }
    };
  }, [socket]);

  const fetchPlants = async () => {
    try {
      // Get plants from all devices owned by this manager
      const devicesRes = await axios.get('/api/devices');
      const devices = devicesRes.data.devices;
      
      let allPlants = [];
      for (const device of devices) {
        try {
          const plantsRes = await axios.get(`/api/plants/device/${device._id}`);
          allPlants = [...allPlants, ...plantsRes.data.plants];
        } catch (error) {
          console.error(`Failed to fetch plants for device ${device._id}:`, error);
        }
      }
      
      setPlants(allPlants);
    } catch (error) {
      console.error('Failed to fetch plants:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStageColor = (stage) => {
    switch (stage) {
      case 'seed': return 'default';
      case 'germination': return 'info';
      case 'seedling': return 'primary';
      case 'vegetative': return 'success';
      case 'flowering': return 'warning';
      case 'fruiting': return 'secondary';
      case 'harvest': return 'error';
      default: return 'default';
    }
  };

  const getStageLabel = (stage) => {
    const labels = {
      seed: 'Hạt giống',
      germination: 'Nảy mầm',
      seedling: 'Cây con',
      vegetative: 'Phát triển',
      flowering: 'Ra hoa',
      fruiting: 'Kết quả',
      harvest: 'Thu hoạch'
    };
    return labels[stage] || stage;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Typography>Đang tải...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        Quản lý cây trồng
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Theo dõi tiến độ phát triển của tất cả cây trồng trong các thiết bị của bạn.
      </Alert>

      <Grid container spacing={3}>
        {plants.map((plant) => (
          <Grid item xs={12} md={6} lg={4} key={plant._id}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Eco sx={{ mr: 1, color: 'success.main' }} />
                  <Typography variant="h6" component="div">
                    {plant.name}
                  </Typography>
                </Box>
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {plant.variety} • {plant.type}
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={getStageLabel(plant.growthStage)}
                    color={getStageColor(plant.growthStage)}
                    size="small"
                  />
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Tiến độ phát triển</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {Math.round(plant.growthProgress)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={plant.growthProgress}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Schedule sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    Trồng: {new Date(plant.plantedDate).toLocaleDateString('vi-VN')}
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <TrendingUp sx={{ mr: 1, fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    Dự kiến thu hoạch: {new Date(plant.expectedHarvestDate).toLocaleDateString('vi-VN')}
                  </Typography>
                </Box>

                {plant.growthProgress >= 80 && (
                  <Alert severity="success" sx={{ mt: 2 }}>
                    Sắp thu hoạch!
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {plants.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Eco sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Chưa có cây trồng nào
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Người dùng của bạn chưa trồng cây nào trong các thiết bị.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default PlantManagement;