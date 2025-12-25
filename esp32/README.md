# ESP32 Smart Garden - Wokwi Simulator

## Mô tả
Code ESP32 cho hệ thống Smart Garden, kết nối MQTT để gửi dữ liệu cảm biến và nhận lệnh điều khiển.

## Phần cứng (Wokwi)
- **ESP32 DevKit C V4**
- **DHT22** - Cảm biến nhiệt độ & độ ẩm (GPIO 15)
- **LDR** - Cảm biến ánh sáng (GPIO 34)
- **PIR** - Cảm biến chuyển động (GPIO 12)
- **LCD 16x2 I2C** - Hiển thị (SDA: 21, SCL: 22)
- **7 LED** - Mô phỏng thiết bị điều khiển:
  - LED Đỏ (GPIO 32) - Light
  - LED Xanh lá (GPIO 33) - Fan
  - LED Xanh dương (GPIO 25) - Pump
  - LED Vàng (GPIO 26) - Watering
  - LED Tím (GPIO 27) - Heater
  - LED Trắng (GPIO 14) - Cooler
  - LED Cam (GPIO 13) - Mist

## MQTT Topics

### Publish (ESP32 → Server)
- `smartgarden/{DEVICE_ID}/telemetry` - Dữ liệu cảm biến
- `smartgarden/{DEVICE_ID}/status` - Trạng thái online/offline
- `smartgarden/{DEVICE_ID}/control/ack` - Xác nhận lệnh điều khiển

### Subscribe (Server → ESP32)
- `smartgarden/{DEVICE_ID}/control` - Nhận lệnh điều khiển

## Định dạng dữ liệu

### Telemetry (gửi mỗi 5 giây)
```json
{
  "temperature": 25.5,
  "humidity": 60,
  "light": 75,
  "soil_moisture": 45,
  "motion": false,
  "timestamp": 12345678
}
```

### Control Command (nhận từ server)
```json
{
  "type": "fan",
  "action": "on",
  "intensity": 100,
  "timestamp": 1735100000000
}
```

### Control Ack (gửi sau khi thực hiện lệnh)
```json
{
  "type": "fan",
  "enabled": true,
  "intensity": 100,
  "timestamp": 12345678
}
```

## Cách chạy trên Wokwi

1. Truy cập https://wokwi.com
2. Tạo project mới → ESP32
3. Copy nội dung `diagram.json` vào tab Diagram
4. Copy nội dung `sketch.ino` vào tab Code
5. Nhấn Play để chạy simulation

## Cấu hình

Thay đổi trong `sketch.ino`:
```cpp
const char* DEVICE_ID = "ESP32_001";  // ID thiết bị của bạn
```

## Lưu ý
- Wokwi sử dụng WiFi ảo "Wokwi-GUEST" (không cần password)
- MQTT broker: broker.emqx.io (public, free)
- Soil moisture được random vì Wokwi không có cảm biến này
