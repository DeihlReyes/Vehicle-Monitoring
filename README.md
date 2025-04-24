# Riding Behavior Monitoring System

A real-time motorcycle behavior monitoring system that runs on a Raspberry Pi with a 7-inch touchscreen display.

## Hardware Requirements

- Raspberry Pi (3 or newer recommended)
- 7-inch Raspberry Pi Official Touchscreen Display
- MPU6050 Sensor (connected via I2C)
- OBD-II Adapter (Bluetooth or WiFi)
- Power supply for Raspberry Pi

## Hardware Setup

1. **MPU6050 Connection**:

   - VCC → 3.3V (Pin 1)
   - GND → Ground (Pin 6)
   - SCL → I2C SCL (Pin 5)
   - SDA → I2C SDA (Pin 3)

2. **Enable I2C on Raspberry Pi**:

   ```bash
   sudo raspi-config
   # Navigate to Interface Options → I2C → Enable
   ```

3. **Touchscreen Setup**:
   Follow the [official Raspberry Pi documentation](https://www.raspberrypi.com/documentation/accessories/display.html) for display setup.

## Software Requirements

- Python 3.8 or newer
- pip (Python package manager)
- Web browser (Chromium recommended)

## Installation

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd Vehicle\ Monitoring
   ```

2. **Set up Python virtual environment**:

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Linux/Mac
   # OR
   .\venv\Scripts\activate  # On Windows
   ```

3. **Install Python dependencies**:

   ```bash
   pip install -r backend/requirements.txt
   ```

4. **Configure autostart** (optional):
   To start the application automatically when the Raspberry Pi boots:
   ```bash
   sudo nano /etc/xdg/autostart/vehicle-monitor.desktop
   ```
   Add the following content:
   ```ini
   [Desktop Entry]
   Type=Application
   Name=Vehicle Monitor
   Exec=/home/pi/Vehicle\ Monitoring/start.sh
   ```

## Running the Application

1. **Start the backend server**:

   ```bash
   cd backend
   python app.py
   ```

2. **Access the web interface**:
   - Open a web browser (preferably in full-screen mode)
   - Navigate to: `http://localhost:5000`
   - For touchscreen, use the Chromium browser in kiosk mode:
     ```bash
     chromium-browser --kiosk http://localhost:5000
     ```

## Usage

1. **Dashboard Tab**:

   - View behavior summary
   - Check recent riding sessions
   - Monitor system status

2. **Behavior Tab**:

   - Real-time accelerometer data
   - Real-time gyroscope data
   - Current behavior classification

3. **OBD Info Tab**:
   - Engine speed and RPM
   - Temperature and load metrics
   - System diagnostics

## Troubleshooting

1. **Hardware Connection Issues**:

   - Check I2C connection: `i2cdetect -y 1`
   - Verify OBD adapter connection: `sudo hcitool scan`
   - Check system logs: `sudo journalctl -f`

2. **Software Issues**:

   - Check application logs: `tail -f vehicle_monitor.log`
   - Verify database: `sqlite3 vehicle_data.db .tables`
   - Monitor system resources: `top`

3. **Display Issues**:
   - Calibrate touchscreen: `DISPLAY=:0 xinput_calibrator`
   - Check display config: `sudo nano /boot/config.txt`

## Development

- Backend code is in the `backend/` directory
- Frontend code is in the `frontend/` directory
- Database is automatically created at first run
- Logs are stored in `vehicle_monitor.log`

## System Architecture

```
├── backend/
│   ├── app.py           # Main application server
│   ├── mpu6050.py      # MPU6050 sensor interface
│   ├── obd.py          # OBD-II communication
│   ├── database.py     # Database management
│   └── behavior_model.py# LSTM behavior prediction
├── frontend/
│   ├── index.html      # Main UI
│   ├── css/            # Styles
│   └── js/             # Client-side logic
└── vehicle_data.db     # SQLite database
```
