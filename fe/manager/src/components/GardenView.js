import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert
} from '@mui/material';
import { Landscape } from '@mui/icons-material';

function GardenView() {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        Xem vườn
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Tính năng xem vườn trực tiếp sẽ được phát triển trong phiên bản tiếp theo.
      </Alert>

      <Card>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Landscape sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Xem vườn trực tiếp
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Bạn sẽ có thể xem vườn của mình từ đây:
          </Typography>
          <Box sx={{ mt: 2, textAlign: 'left', maxWidth: 400, mx: 'auto' }}>
            <Typography variant="body2" color="text.secondary" component="ul">
              <li>Bản đồ vị trí thiết bị</li>
              <li>Cấu trúc layout vườn</li>
              <li>Camera trực tiếp</li>
              <li>Thông tin thời tiết</li>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default GardenView;