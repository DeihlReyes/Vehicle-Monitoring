## 🚦 Riding Behavior Monitoring App – Product Requirement Description

### 🧩 Overview

The **Riding Behavior Monitoring App** is a lightweight system designed to run on a **Raspberry Pi**. It serves as a real-time behavioral and diagnostic tool for motorcycles by analyzing riding habits and reading engine data through onboard sensors and an OBD device. The main interface is a **web application** tailored to fit a 7-inch touchscreen display.

---

### 🖥️ User Interface (UI)

- The app UI is optimized for a **7-inch Raspberry Pi touchscreen**.
- The layout is minimal, responsive, and fits within a container that matches the screen size.
- A **bottom tab switcher** provides easy navigation between three main sections:

  1. **Dashboard**

     - Displays aggregated and visualized predictions of rider behavior (e.g., aggressive acceleration, lane changes).
     - Data is generated using a trained LSTM model.

  2. **Behavior**

     - Live stream of behavior data collected from the MPU6050 sensor.
     - Shows gyro and acceleration data in real time.

  3. **OBD Info**
     - Displays live vehicle diagnostic data from a connected OBD device.
     - Includes key engine metrics such as:
       - Throttle Position
       - Engine Load
       - Coolant Temperature
       - Battery Voltage
       - Fuel System Status
       - O2 Sensor Readings
       - Intake Manifold Pressure
       - Timing Advance

---

### 🧠 Behavior Prediction (ML Component)

- Behavior classification is powered by an **LSTM (Long Short-Term Memory)** model.
- The input for this model comes from the **MPU6050 sensor**, which provides:

  - Accelerometer data (converted to m/s²)
  - Gyroscope data (°/s)

- Detected behaviors may include:
  - Aggressive/Normal Acceleration
  - Aggressive/Normal Deceleration
  - Aggressive/Normal Lane Change

---

### 🔌 Sensor Integration

- **MPU6050 (Gyroscope + Accelerometer)**

  - Communicates via **I2C**
  - Reads motion data, which is normalized and fed into the LSTM model.

- **OBD-II Bluetooth/WiFi Device**
  - Reads real-time vehicle diagnostics.
  - Communicates with the Raspberry Pi via supported Python libraries.

---

### 🛠️ Tech Stack

| Component      | Technology Used                      |
| -------------- | ------------------------------------ |
| Frontend       | HTML, CSS, JavaScript                |
| Backend/API    | Python                               |
| ML Integration | LSTM model using TensorFlow/Keras    |
| Sensor Access  | Python (`smbus2`, `pyserial`, `OBD`) |
| Deployment     | Raspberry Pi (Linux-based OS)        |

---

### 👤 User Stories & Linked Features

#### 🧍 **As a rider:**

- **“I want to see a live stream of my riding behavior so I can understand how I'm driving in real time.”**  
  → _Linked Feature_: `Behavior Tab` with live MPU6050 data display (acceleration and gyro feed)

- **“I want to view a summary on the dashboard so I can reflect on my behavior trends after the ride.”**  
  → _Linked Feature_: `Dashboard Tab` showing behavior classification results (e.g., counts of aggressive acceleration events)

- **“I want the app to identify aggressive driving behavior automatically so I can improve my riding style.”**  
  → _Linked Feature_: `LSTM Model Integration` in backend predicting and tagging behaviors in real-time

- **“I want to access engine and bike condition data from the OBD so I can monitor performance and detect issues early.”**  
  → _Linked Feature_: `OBD Info Tab` displaying live readings from OBD-II (throttle, engine load, battery, etc.)

---

#### 👨‍🔧 **As a mechanic or technician:**

- **“I want to see OBD data like engine load, battery voltage, and throttle position so I can quickly diagnose engine issues.”**  
  → _Linked Feature_: `OBD Info Tab` with diagnostic OBD data dashboard

- **“I want the ability to log sensor and OBD data so I can analyze it later.”**  
  → _Linked Feature_: `Backend logging functionality` for exporting MPU6050 and OBD data to CSV or similar formats
