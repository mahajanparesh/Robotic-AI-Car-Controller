
# 🤖 AI-Powered Voice & Text Controlled Robotic Car

This project demonstrates a cutting-edge integration of **Generative AI** with **Robotics and IoT Automation**, using **Google AI technologies** such as **Vertex AI** and **Gemini API**. It enables real-time control of a robotic car via both **natural language text commands** and **voice input**, supporting **multilingual voice recognition** (e.g., Hindi, English, etc.) and a responsive **React-based UI**.

---
## 📽️ Deployed Website Link

> https://genai-exchange-bootcamp-462109.web.app/app.tsx

---

## 📽️ Demo Video

> [[Watch the full demo here](https://drive.google.com/file/d/1LosG1g4OIYx_ON-nQjEminQw5kPsJua2/view?usp=sharing)]

---

## 🚀 Features

- 🎙️ Voice and Text command control via React frontend
- 🌐 Google Cloud Speech-to-Text API for dynamic voice recognition
- 🤖 Real-time control of robotic car using MQTT and NodeMCU (ESP8266)
- 🧠 Natural Language Processing with Vertex AI + Gemini API
- 🔄 Two-way communication between user and robot
- 🗣️ Multilingual support (English, Hindi, etc.)
- ⚛️ Modern UI built with **React.js**

---

## 🧰 Tech Stack

| Layer         | Technology                          |
|---------------|--------------------------------------|
| Frontend      | React.js (Vite / CRA)                |
| Backend API   | FastAPI (Python)                     |
| Speech Input  | Google Cloud Speech-to-Text          |
| NLP Engine    | Vertex AI (Gemini API)               |
| Messaging     | MQTT (PubSub)                        |
| Hardware      | NodeMCU (ESP8266), L298N Motor Driver|
| Communication | Wi-Fi + MQTT Protocol                |

---

## 📂 Folder Structure

```
├── backend/
│   ├── app.py                  # FastAPI app
│   ├── speech_to_text.py       # Google STT integration
│   ├── vertex_handler.py       # Gemini API logic
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   ├── App.tsx
│   │   ├── index.tsx
├── backend_robot/WIFI_Controlled_Car12
│   └── WIFI_Controlled_Car12.ino       # NodeMCU MQTT sketch
├── README.md
```

---

## ⚛️ React Frontend

### Run Frontend
```bash
cd frontend
npm install
npm run dev
```

### Key Features
- Mic input to capture voice commands
- Textbox for manual command input
- Real-time status and logs
- REST API call to FastAPI backend
- Uses `navigator.mediaDevices` for audio capture

---

## 🛠️ Backend Setup

### 1. Clone the Repository
```bash
git clone https://github.com/mahajanparesh/Robotic-AI-Car-Controller.git
cd Robotic-AI-Car-Controller
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
```

- Set your Google credentials:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="path/to/your-credentials.json"
```

### 3. Start FastAPI Server
```bash
uvicorn app:app --reload --port 8000
```

---

## 🤖 NodeMCU (ESP8266) Setup

- Use Arduino IDE to upload `robot_control.ino` from `/arduino/`
- Configure:
  - Wi-Fi credentials
  - MQTT broker IP
  - D1 → ENA (Speed)
  - D5 → ENB (Speed)
  - D6 → Motor control (based on your wiring)

---

## 🎮 Sample Commands

| Voice/Text Command     | Result            |
|------------------------|-------------------|
| "Move forward"         | Moves ahead       |
| "Turn right"           | Takes a right turn|
| "Stop"                 | Halts completely  |
| "Go backward"          | Reverses          |
| Hindi: "आगे बढ़ो"     | Moves ahead       |
| Hindi: "बाएं मुड़ो"   | Turns left        |

---

## 🧑‍💻 Author

**Paresh Mahajan**  
📧 pareshdattatraymahajan@gmail.com  
🔗 [LinkedIn](https://linkedin.com/in/mahajanparesh) | [GitHub](https://github.com/mahajanparesh)

---

## 🏁 Future Scope

- Add obstacle detection
- Use AI for path planning
- Implement user authentication
- Add command logging and replay


---

## 🙌 Acknowledgements

- Google AI Ecosystem
- Open Source Libraries (React, FastAPI, MQTT, etc.)

---
