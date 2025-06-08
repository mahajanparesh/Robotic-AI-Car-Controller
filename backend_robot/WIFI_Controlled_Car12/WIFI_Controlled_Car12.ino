#include <ESP8266WiFi.h>
#include <PubSubClient.h>

// WiFi Credentials
const char* ssid = "Airtel_PARESH";
const char* password = "Paresh2000";

// MQTT Broker
const char* mqtt_server = "35.200.230.224"; // Replace with your MQTT broker's IP
const char* mqtt_topic = "robot/control";

WiFiClient espClient;
PubSubClient client(espClient);

// Motor Driver Pins
#define ENA   12  // Right motors enable (PWM)
#define ENB   14  // Left motors enable (PWM)
#define IN_1  15  // Right motor IN1
#define IN_2  13  // Right motor IN2
#define IN_3  2   // Left motor IN3
#define IN_4  0   // Left motor IN4

void setup() {
  Serial.begin(115200);

  pinMode(ENA, OUTPUT);
  pinMode(ENB, OUTPUT);
  pinMode(IN_1, OUTPUT);
  pinMode(IN_2, OUTPUT);
  pinMode(IN_3, OUTPUT);
  pinMode(IN_4, OUTPUT);

  setup_wifi();

  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
}

void setup_wifi() {
  delay(10);
  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected. IP: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect("NodeMCUClient")) {
      Serial.println("connected");
      client.subscribe(mqtt_topic);
    } else {
      Serial.print("Failed. State: ");
      Serial.println(client.state());
      delay(2000);
    }
  }
}

void moveMotors(int rightVal, int leftVal, int speedPercent) {
  int pwmSpeed = map(speedPercent, 0, 100, 0, 1023); // Convert 0–100% to 0–1023

  // Right Motor
  if (rightVal == 1) {
    digitalWrite(IN_1, LOW);
    digitalWrite(IN_2, HIGH);
    analogWrite(ENA, pwmSpeed);
  } else if (rightVal == -1) {
    digitalWrite(IN_1, HIGH);
    digitalWrite(IN_2, LOW);
    analogWrite(ENA, pwmSpeed);
  } else {
    digitalWrite(IN_1, LOW);
    digitalWrite(IN_2, LOW);
    analogWrite(ENA, 0);
  }

  // Left Motor
  if (leftVal == 1) {
    digitalWrite(IN_3, LOW);
    digitalWrite(IN_4, HIGH);
    analogWrite(ENB, pwmSpeed);
  } else if (leftVal == -1) {
    digitalWrite(IN_3, HIGH);
    digitalWrite(IN_4, LOW);
    analogWrite(ENB, pwmSpeed);
  } else {
    digitalWrite(IN_3, LOW);
    digitalWrite(IN_4, LOW);
    analogWrite(ENB, 0);
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("Received MQTT: ");
  Serial.println(message);

  int rightVal = 0, leftVal = 0, speed = 100;

  int rIdx = message.indexOf("right=");
  int lIdx = message.indexOf("left=");
  int sIdx = message.indexOf("speed=");

  if (rIdx != -1 && lIdx != -1 && sIdx != -1) {
    rightVal = message.substring(rIdx + 6, message.indexOf(",", rIdx)).toInt();
    leftVal = message.substring(lIdx + 5, message.indexOf(",", lIdx)).toInt();
    speed = message.substring(sIdx + 6).toInt();

    moveMotors(rightVal, leftVal, speed);
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
}
