#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <LiquidCrystal_I2C.h>
#include <Wire.h>

// ==================== CONFIG ====================
// WiFi - Wokwi uses special WiFi
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASS = "";

// MQTT Broker
const char* MQTT_BROKER = "broker.emqx.io";
const int MQTT_PORT = 1883;
const char* TOPIC_PREFIX = "smartgarden";

// Device ID - must match deviceId field in database
const char* DEVICE_ID = "100100C40A24";

// ==================== PIN DEFINITIONS ====================
// DHT22 Sensor
#define DHT_PIN 15
#define DHT_TYPE DHT22

// PIR Motion Sensor
#define PIR_PIN 12

// LDR Light Sensor
#define LDR_PIN 34

// LED Controls (simulating actuators)
#define LED_LIGHT 32      // Red - Light control
#define LED_FAN 33        // Green - Fan control
#define LED_PUMP 25       // Blue - Pump control
#define LED_WATERING 26   // Yellow - Watering control
#define LED_HEATER 27     // Purple - Heater control
#define LED_COOLER 14     // White - Cooler control
#define LED_MIST 13       // Orange - Mist control

// LCD I2C
#define LCD_ADDR 0x27
#define LCD_COLS 16
#define LCD_ROWS 2

// ==================== OBJECTS ====================
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
DHT dht(DHT_PIN, DHT_TYPE);
LiquidCrystal_I2C lcd(LCD_ADDR, LCD_COLS, LCD_ROWS);

// ==================== VARIABLES ====================
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 5000; // 5 seconds

// Control states
struct ControlState {
  bool enabled;
  int intensity;
};

ControlState controls[7] = {
  {false, 100}, // light
  {false, 100}, // fan
  {false, 100}, // pump
  {false, 100}, // watering
  {false, 100}, // heater
  {false, 100}, // cooler
  {false, 100}  // mist
};

const char* controlNames[] = {"light", "fan", "pump", "watering", "heater", "cooler", "mist"};
const int controlPins[] = {LED_LIGHT, LED_FAN, LED_PUMP, LED_WATERING, LED_HEATER, LED_COOLER, LED_MIST};

// Topics
char topicTelemetry[64];
char topicControl[64];
char topicStatus[64];
char topicControlAck[64];

// ==================== SETUP ====================
void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Smart Garden ESP32 ===");
  
  // Initialize pins
  initPins();
  
  // Initialize LCD
  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Smart Garden");
  lcd.setCursor(0, 1);
  lcd.print("Initializing...");
  
  // Initialize DHT
  dht.begin();
  
  // Build topic strings
  sprintf(topicTelemetry, "%s/%s/telemetry", TOPIC_PREFIX, DEVICE_ID);
  sprintf(topicControl, "%s/%s/control", TOPIC_PREFIX, DEVICE_ID);
  sprintf(topicStatus, "%s/%s/status", TOPIC_PREFIX, DEVICE_ID);
  sprintf(topicControlAck, "%s/%s/control/ack", TOPIC_PREFIX, DEVICE_ID);
  
  // Connect WiFi
  connectWiFi();
  
  // Setup MQTT
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);
  
  // Connect MQTT
  connectMQTT();
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connected!");
}


// ==================== LOOP ====================
void loop() {
  // Maintain MQTT connection
  if (!mqtt.connected()) {
    connectMQTT();
  }
  mqtt.loop();
  
  // Send telemetry periodically
  if (millis() - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    sendTelemetry();
    lastTelemetryTime = millis();
  }
  
  // Update LCD display
  updateLCD();
  
  delay(100);
}

// ==================== FUNCTIONS ====================

void initPins() {
  // LED outputs
  for (int i = 0; i < 7; i++) {
    pinMode(controlPins[i], OUTPUT);
    digitalWrite(controlPins[i], LOW);
  }
  
  // PIR input
  pinMode(PIR_PIN, INPUT);
  
  // LDR input
  pinMode(LDR_PIN, INPUT);
}

void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi connection failed!");
  }
}

void connectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("Connecting to MQTT...");
    
    String clientId = "ESP32_" + String(random(0xffff), HEX);
    
    if (mqtt.connect(clientId.c_str())) {
      Serial.println("connected!");
      
      // Subscribe to control topic
      mqtt.subscribe(topicControl);
      Serial.print("Subscribed to: ");
      Serial.println(topicControl);
      
      // Publish online status
      publishStatus("online");
      
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqtt.state());
      Serial.println(" retrying in 5s...");
      delay(5000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message received [");
  Serial.print(topic);
  Serial.print("]: ");
  
  // Parse JSON payload
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  
  if (error) {
    Serial.print("JSON parse error: ");
    Serial.println(error.c_str());
    return;
  }
  
  // Handle control command
  if (String(topic) == String(topicControl)) {
    handleControlCommand(doc);
  }
}

void handleControlCommand(JsonDocument& doc) {
  const char* type = doc["type"];
  const char* action = doc["action"];
  int intensity = doc["intensity"] | 100;
  
  Serial.print("Control: ");
  Serial.print(type);
  Serial.print(" -> ");
  Serial.print(action);
  Serial.print(" (");
  Serial.print(intensity);
  Serial.println("%)");
  
  // Find control index
  int idx = -1;
  for (int i = 0; i < 7; i++) {
    if (strcmp(type, controlNames[i]) == 0) {
      idx = i;
      break;
    }
  }
  
  Serial.print("Control index: ");
  Serial.println(idx);
  
  if (idx >= 0) {
    bool enabled = (strcmp(action, "on") == 0);
    controls[idx].enabled = enabled;
    controls[idx].intensity = intensity;
    
    Serial.print("Enabled: ");
    Serial.println(enabled ? "true" : "false");
    
    // Apply to LED (PWM for intensity)
    if (enabled) {
      int pwmValue = map(intensity, 0, 100, 0, 255);
      analogWrite(controlPins[idx], pwmValue);
      Serial.print("LED ON with PWM: ");
      Serial.println(pwmValue);
    } else {
      digitalWrite(controlPins[idx], LOW);
      Serial.println("LED OFF");
    }
    
    // Send acknowledgment
    sendControlAck(type, enabled, intensity);
  } else {
    Serial.print("Unknown control type: ");
    Serial.println(type);
  }
}

void sendControlAck(const char* type, bool enabled, int intensity) {
  StaticJsonDocument<128> doc;
  doc["type"] = type;
  doc["enabled"] = enabled;
  doc["intensity"] = intensity;
  doc["timestamp"] = millis();
  
  char buffer[128];
  serializeJson(doc, buffer);
  mqtt.publish(topicControlAck, buffer);
}

void sendTelemetry() {
  // Read sensors
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  int lightRaw = analogRead(LDR_PIN);
  int light = map(lightRaw, 0, 4095, 0, 100);
  bool motion = digitalRead(PIR_PIN);
  
  // Simulate values if sensors return NaN (common in Wokwi)
  if (isnan(temperature)) temperature = 20.0 + random(0, 150) / 10.0; // 20-35°C
  if (isnan(humidity)) humidity = 40.0 + random(0, 40); // 40-80%
  
  // Simulate sensors not available in Wokwi
  int soilMoisture = random(30, 70);
  float wind = random(0, 30) + random(0, 10) / 10.0;
  
  // Build JSON
  StaticJsonDocument<256> doc;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["light"] = light;
  doc["soil_moisture"] = soilMoisture;
  doc["wind"] = wind;
  doc["motion"] = motion;
  doc["timestamp"] = millis();
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  // Publish
  if (mqtt.publish(topicTelemetry, buffer)) {
    Serial.print("Telemetry sent: ");
    Serial.println(buffer);
  } else {
    Serial.println("Telemetry publish failed!");
  }
}

void publishStatus(const char* status) {
  StaticJsonDocument<64> doc;
  doc["status"] = status;
  doc["timestamp"] = millis();
  
  char buffer[64];
  serializeJson(doc, buffer);
  mqtt.publish(topicStatus, buffer);
}

void updateLCD() {
  static unsigned long lastLCDUpdate = 0;
  if (millis() - lastLCDUpdate < 1000) return;
  lastLCDUpdate = millis();
  
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  
  // Use simulated values if sensor returns NaN
  float displayTemp = isnan(temp) ? (20.0 + random(0, 100) / 10.0) : temp;
  float displayHum = isnan(hum) ? (50.0 + random(0, 30)) : hum;
  int light = map(analogRead(LDR_PIN), 0, 4095, 0, 100);
  
  // Line 1: Temperature & Humidity
  lcd.setCursor(0, 0);
  lcd.print("T:");
  lcd.print(displayTemp, 1);
  lcd.print("C H:");
  lcd.print((int)displayHum);
  lcd.print("%  ");
  
  // Line 2: Light & Active controls
  lcd.setCursor(0, 1);
  lcd.print("L:");
  lcd.print(light);
  lcd.print("% ");
  
  int activeCount = 0;
  for (int i = 0; i < 7; i++) {
    if (controls[i].enabled) activeCount++;
  }
  lcd.print("On:");
  lcd.print(activeCount);
  lcd.print("   ");
}
