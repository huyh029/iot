"""
ThingsBoard Sensor Simulator
Giả lập ESP32 gửi dữ liệu sensor lên ThingsBoard và Backend

Cách chạy:
    pip install paho-mqtt requests
    python thingsboard_simulator.py
"""

import json
import random
import time
import requests
import paho.mqtt.client as mqtt
from datetime import datetime

# ThingsBoard Configuration
THINGSBOARD_HOST = "thingsboard.cloud"
THINGSBOARD_PORT = 1883
ACCESS_TOKEN = "LfGBRhuqO32PWlGh0mC9"

# Backend Configuration (để gửi trực tiếp đến backend)
BACKEND_URL = "http://localhost:5000/api/thingsboard/webhook"

# Simulation settings
INTERVAL_SECONDS = 5  # Gửi dữ liệu mỗi 5 giây

# Sensor ranges
SENSOR_RANGES = {
    "temperature": {"min": 20, "max": 35, "unit": "°C"},
    "humidity": {"min": 40, "max": 90, "unit": "%"},
    "light": {"min": 100, "max": 2000, "unit": "lux"},
    "soil_moisture": {"min": 20, "max": 80, "unit": "%"},
    "wind": {"min": 0, "max": 20, "unit": "km/h"}
}

# Current values (for smooth transitions)
current_values = {
    "temperature": 25.0,
    "humidity": 65.0,
    "light": 1000.0,
    "soil_moisture": 50.0,
    "wind": 5.0
}


def generate_sensor_data():
    """Generate random sensor data with smooth transitions"""
    global current_values
    
    for sensor, config in SENSOR_RANGES.items():
        # Random walk with bounds
        change = random.uniform(-2, 2)
        new_value = current_values[sensor] + change
        
        # Keep within bounds
        new_value = max(config["min"], min(config["max"], new_value))
        current_values[sensor] = round(new_value, 1)
    
    return current_values.copy()


def on_connect(client, userdata, flags, rc):
    """MQTT connection callback"""
    if rc == 0:
        print("✅ Connected to ThingsBoard MQTT broker")
    else:
        print(f"❌ Failed to connect, return code {rc}")


def on_publish(client, userdata, mid):
    """MQTT publish callback"""
    print(f"📤 Message {mid} published to ThingsBoard")


def send_to_thingsboard_mqtt(client, data):
    """Send telemetry via MQTT"""
    try:
        payload = json.dumps(data)
        result = client.publish("v1/devices/me/telemetry", payload, qos=1)
        return result.rc == mqtt.MQTT_ERR_SUCCESS
    except Exception as e:
        print(f"❌ MQTT error: {e}")
        return False


def send_to_thingsboard_http(data):
    """Send telemetry via HTTP API"""
    try:
        url = f"https://{THINGSBOARD_HOST}/api/v1/{ACCESS_TOKEN}/telemetry"
        response = requests.post(url, json=data, timeout=5)
        return response.status_code == 200
    except Exception as e:
        print(f"❌ HTTP error: {e}")
        return False


def send_to_thingsboard_attributes(data):
    """Send data as client attributes (readable via device token)"""
    try:
        url = f"https://{THINGSBOARD_HOST}/api/v1/{ACCESS_TOKEN}/attributes"
        response = requests.post(url, json=data, timeout=5)
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Attributes error: {e}")
        return False


def send_to_backend(data):
    """Send telemetry directly to backend webhook"""
    try:
        # Include accessToken so backend knows which device this data belongs to
        payload = {**data, "accessToken": ACCESS_TOKEN}
        response = requests.post(BACKEND_URL, json=payload, timeout=5)
        return response.status_code == 200
    except Exception as e:
        print(f"❌ Backend error: {e}")
        return False


def print_data(data):
    """Pretty print sensor data"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"\n{'='*50}")
    print(f"📊 Sensor Data - {timestamp}")
    print(f"{'='*50}")
    for sensor, value in data.items():
        config = SENSOR_RANGES.get(sensor, {"unit": ""})
        print(f"  {sensor.replace('_', ' ').title():15} : {value:6.1f} {config['unit']}")
    print(f"{'='*50}")


def main():
    print("""
╔══════════════════════════════════════════════════════╗
║     ThingsBoard Sensor Simulator                     ║
║     Device: TB_Cloud_Device_01                       ║
╚══════════════════════════════════════════════════════╝
    """)
    
    # Setup MQTT client
    client = mqtt.Client()
    client.username_pw_set(ACCESS_TOKEN)
    client.on_connect = on_connect
    client.on_publish = on_publish
    
    # Connect to ThingsBoard
    print(f"🔌 Connecting to {THINGSBOARD_HOST}:{THINGSBOARD_PORT}...")
    try:
        client.connect(THINGSBOARD_HOST, THINGSBOARD_PORT, 60)
        client.loop_start()
        time.sleep(2)  # Wait for connection
    except Exception as e:
        print(f"❌ Could not connect to MQTT: {e}")
        print("⚠️  Will use HTTP API instead")
    
    print(f"\n🚀 Starting simulation (interval: {INTERVAL_SECONDS}s)")
    print("Press Ctrl+C to stop\n")
    
    try:
        while True:
            # Generate sensor data
            data = generate_sensor_data()
            print_data(data)
            
            # Send to ThingsBoard via MQTT (telemetry)
            if client.is_connected():
                mqtt_success = send_to_thingsboard_mqtt(client, data)
                print(f"  MQTT to ThingsBoard: {'✅' if mqtt_success else '❌'}")
            else:
                # Fallback to HTTP
                http_success = send_to_thingsboard_http(data)
                print(f"  HTTP to ThingsBoard: {'✅' if http_success else '❌'}")
            
            # Also send as attributes (so backend can read via device token)
            attr_success = send_to_thingsboard_attributes(data)
            print(f"  Attributes to TB:    {'✅' if attr_success else '❌'}")
            
            # Also send to backend directly
            backend_success = send_to_backend(data)
            print(f"  Direct to Backend:   {'✅' if backend_success else '❌'}")
            
            # Wait for next interval
            time.sleep(INTERVAL_SECONDS)
            
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping simulator...")
    finally:
        client.loop_stop()
        client.disconnect()
        print("👋 Goodbye!")


if __name__ == "__main__":
    main()
