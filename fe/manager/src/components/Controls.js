import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Alert
} from '@mui/material';
import { Settings } from '@mui/icons-material';

function Controls() {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3, fontWeight: 'bold' }}>
        Điều khiển thiết bị
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        Tính năng điều khiển thiết bị sẽ được phát triển trong phiên bản tiếp theo.
      </Alert>

      <Card>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          <Settings sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Điều khiển thiết bị
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Bạn sẽ có thể điều khiển các thiết bị ESP32 của mình từ đây:
          </Typography>
          <Box sx={{ mt: 2, textAlign: 'left', maxWidth: 400, mx: 'auto' }}>
            <Typography variant="body2" color="text.secondary" component="ul">
              <li>Điều khiển thủ công (bật/tắt đèn, tưới cây)</li>
              <li>Hẹn giờ tự động</li>
              <li>Chế độ auto (duy trì điều kiện)</li>
              <li>Cảnh báo ngưỡng</li>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default Controls;