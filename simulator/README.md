# Smart Garden Simulators

## 1. ESP32-CAM Simulator

Giả lập camera ESP32-CAM cho Smart Garden IoT System.

### Chạy ESP32-CAM Simulator

```bash
cd simulator/esp32-cam
node server.js
```

Sau đó mở trình duyệt: http://localhost:8081

### Tính năng
- 🎬 Live video stream giả lập vườn cây
- 🌿 4 scene: Garden, Greenhouse, Night, Rain
- 🌙 Night mode filter
- 📸 Chụp ảnh snapshot
- 📊 Hiển thị sensor data giả lập
- 📋 Copy URL để dùng trong Smart Garden Manager

### Sử dụng với Smart Garden Manager
1. Chạy ESP32-CAM simulator
2. Mở Smart Garden Manager → Xem vườn → Camera
3. Nhập URL: `http://localhost:8081`

---

## 2. ThingsBoard Sensor Simulator

Giả lập ESP32 gửi dữ liệu sensor lên ThingsBoard và Backend.

## Cài đặt

```bash
cd simulator
pip install -r requirements.txt
```

## Chạy

```bash
python thingsboard_simulator.py
```

## Cấu hình

Trong file `thingsboard_simulator.py`:

- `THINGSBOARD_HOST`: Host của ThingsBoard (mặc định: thingsboard.cloud)
- `ACCESS_TOKEN`: Token của device
- `BACKEND_URL`: URL webhook của backend
- `INTERVAL_SECONDS`: Khoảng thời gian giữa các lần gửi (mặc định: 5 giây)

## Dữ liệu giả lập

| Sensor | Min | Max | Unit |
|--------|-----|-----|------|
| Temperature | 20 | 35 | °C |
| Humidity | 40 | 90 | % |
| Light | 100 | 2000 | lux |
| Soil Moisture | 20 | 80 | % |
| Wind | 0 | 20 | km/h |

## Output

Simulator sẽ:
1. Gửi dữ liệu lên ThingsBoard qua MQTT
2. Gửi dữ liệu trực tiếp đến Backend qua HTTP webhook
3. Hiển thị trạng thái gửi trên console
