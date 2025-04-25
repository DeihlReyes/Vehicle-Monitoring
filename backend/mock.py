from quart import Quart, websocket, jsonify, send_from_directory
from quart_cors import cors
import asyncio
import json
from datetime import datetime
import random
import math
import logging
import os
import time

# Configure logging with more detailed format
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Quart(__name__)
app = cors(app, allow_origin="*")  # Enable CORS for all origins

# Serve frontend files
@app.route('/')
async def index():
    return await send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
async def serve_static(path):
    if os.path.exists(f'../frontend/{path}'):
        return await send_from_directory('../frontend', path)
    return "File not found", 404

# Store connected WebSocket clients
connected_clients = set()

class MockDataGenerator:
    def __init__(self):
        self.time = 0
        self.behaviors = ["normal_driving", "aggressive_acceleration", "aggressive_braking", "aggressive_turning"]
        self.behavior_weights = [0.5, 0.2, 0.15, 0.15]  # Increased probability of aggressive behaviors
        self.current_behavior = "normal_driving"
        self.behavior_duration = 0
        
    def generate_sensor_data(self):
        # Simulate accelerometer data with some noise and periodic motion
        accel_x = math.sin(self.time) * 0.5 + random.uniform(-0.1, 0.1)
        accel_y = math.cos(self.time) * 0.3 + random.uniform(-0.1, 0.1)
        accel_z = 9.81 + random.uniform(-0.1, 0.1)  # Approximately 1G with noise
        
        # Simulate gyroscope data with more realistic motion
        gyro_x = math.sin(self.time * 2) * 45 + random.uniform(-5, 5)
        gyro_y = math.cos(self.time * 2) * 30 + random.uniform(-5, 5)
        gyro_z = math.sin(self.time * 1.5) * 20 + random.uniform(-5, 5)
        
        self.time += 0.1  # Increment time
        
        return {
            'accelerometer': {'x': accel_x, 'y': accel_y, 'z': accel_z},
            'gyroscope': {'x': gyro_x, 'y': gyro_y, 'z': gyro_z}  # Use x,y,z instead of roll,pitch,yaw
        }
    
    def generate_obd_data(self):
        # Generate more realistic OBD data with smooth transitions
        speed = abs(50 + 30 * math.sin(self.time * 0.1) + random.uniform(-5, 5))  # 0-120 km/h
        rpm = 1000 + 2000 * abs(math.sin(self.time * 0.2)) + random.uniform(-100, 100)  # 800-6000 rpm
        throttle = max(0, min(100, 50 + 30 * math.sin(self.time * 0.3) + random.uniform(-10, 10)))  # 0-100%
        
        return {
            'SPEED': speed,
            'RPM': rpm,
            'THROTTLE_POS': throttle,
            'ENGINE_LOAD': max(0, min(100, 60 + 20 * math.sin(self.time * 0.1))),
            'COOLANT_TEMP': min(95, 80 + 5 * math.sin(self.time * 0.05)),  # 75-95°C
            'CONTROL_MODULE_VOLTAGE': 13.8 + 0.5 * math.sin(self.time * 0.1),  # 12-14.5V
            'FUEL_STATUS': 'normal',
            'O2_SENSORS': 0.5 + 0.2 * math.sin(self.time * 0.3),
            'INTAKE_PRESSURE': 100 + 5 * math.sin(self.time * 0.2),  # 90-105 kPa
            'TIMING_ADVANCE': 20 + 10 * math.sin(self.time * 0.15)  # 0-40 degrees
        }
    
    def generate_behavior(self):
        # More frequent behavior changes with patterns
        self.behavior_duration += 1
        
        # Force behavior change every 20-30 updates
        if self.behavior_duration >= random.randint(20, 30):
            self.behavior_duration = 0
            new_behavior = random.choices(self.behaviors, weights=self.behavior_weights)[0]
            self.current_behavior = new_behavior
        
        # Add some randomness - 5% chance to change behavior on any frame
        elif random.random() < 0.05:  
            new_behavior = random.choices(self.behaviors, weights=self.behavior_weights)[0]
            self.current_behavior = new_behavior
        
        return {
            'event': self.current_behavior,
            'confidence': round(random.uniform(0.7, 0.95), 2),
            'timestamp': datetime.now().timestamp()
        }

# Initialize mock data generator
mock_generator = MockDataGenerator()

@app.route('/health')
async def health_check():
    """Mock health check endpoint"""
    logger.debug("Health check endpoint called")
    return jsonify({
        "status": "ok",
        "components": {
            "mpu_sensor": True,
            "obd_connection": True
        },
        "error_counts": {
            "hardware": 0,
            "data": 0,
            "connection": 0
        },
        "last_error": None
    })

@app.route('/sessions/recent')
async def get_recent_sessions():
    """Mock sessions endpoint"""
    return jsonify([
        {
            'id': 1, 
            'start_time': (datetime.now().replace(hour=datetime.now().hour-1)).isoformat(),
            'end_time': datetime.now().isoformat(),
            'total_aggressive_events': 12,
            'average_speed': 45.3,
            'max_speed': 85.7
        },
        {
            'id': 2,
            'start_time': (datetime.now().replace(day=datetime.now().day-1)).isoformat(),
            'end_time': (datetime.now().replace(day=datetime.now().day-1, hour=datetime.now().hour+1)).isoformat(),
            'total_aggressive_events': 8,
            'average_speed': 38.9,
            'max_speed': 72.4
        }
    ])

@app.route('/statistics/behavior')
async def get_behavior_stats():
    """Mock behavior statistics endpoint"""
    return jsonify({
        'normal': 75,
        'aggressive_acceleration': 10,
        'aggressive_braking': 8,
        'aggressive_turning': 7
    })

async def broadcast_mock_data():
    """Broadcast mock sensor data to all connected clients"""
    message_count = 0
    error_simulation_time = 0
    last_behavior_time = 0
    while True:
        if not connected_clients:
            await asyncio.sleep(0.1)
            continue

        try:
            # Generate mock data
            sensor_data = mock_generator.generate_sensor_data()
            obd_data = mock_generator.generate_obd_data()
            behavior = mock_generator.generate_behavior()
            
            # Log behavior changes
            current_time = time.time()
            if last_behavior_time == 0 or (current_time - last_behavior_time > 2 and behavior['event'] != 'normal_driving'):
                logger.debug(f"Behavior changed to: {behavior['event']} with confidence {behavior['confidence']}")
                last_behavior_time = current_time

            # Simulate occasional system issues for testing
            error_simulation_time += 0.1
            mpu_sensor_ok = True
            obd_connection_ok = True
            error_counts = {"hardware": 0, "data": 0, "connection": 0}
            last_error = None
            status = "ok"

            # Every 30 seconds, simulate an MPU sensor issue
            if error_simulation_time % 30 < 5:  # 5 seconds of error every 30 seconds
                mpu_sensor_ok = False
                error_counts["hardware"] += 1
                last_error = "MPU6050 communication error: I2C bus failure"
                status = "warning"

            # Every 45 seconds, simulate an OBD connection issue
            if error_simulation_time % 45 < 7:  # 7 seconds of error every 45 seconds
                obd_connection_ok = False
                error_counts["connection"] += 1
                last_error = "OBD connection lost: timeout waiting for response"
                status = "error"

            # Combine all data with the correct format for frontend
            data = {
                'timestamp': datetime.now().isoformat(),
                'sensor_data': sensor_data,
                'obd_data': {
                    'rpm': obd_data['RPM'],
                    'speed': obd_data['SPEED'],
                    'throttle': obd_data['THROTTLE_POS'],
                    'engineLoad': obd_data['ENGINE_LOAD'],
                    'coolant': obd_data['COOLANT_TEMP'],
                    'battery': obd_data['CONTROL_MODULE_VOLTAGE'],
                    'intake': obd_data['INTAKE_PRESSURE']
                },
                'behavior': behavior,
                'system_health': {
                    'status': status,
                    'mpu_sensor_ok': mpu_sensor_ok,
                    'obd_connection_ok': obd_connection_ok,
                    'error_counts': error_counts,
                    'last_error': last_error
                }
            }

            # Log sample data occasionally
            if message_count % 100 == 0:
                logger.debug(f"Sample data being sent: {json.dumps(data)[:200]}...")

            # Broadcast to all connected clients
            disconnected_clients = set()
            for client in connected_clients:
                try:
                    await client.send(json.dumps(data))
                    message_count += 1
                    if message_count % 100 == 0:  # Log every 100 messages
                        logger.debug(f"Sent {message_count} messages to clients")
                except Exception as e:
                    logger.error(f"Error sending to client: {str(e)}")
                    disconnected_clients.add(client)
            
            # Remove disconnected clients
            connected_clients.difference_update(disconnected_clients)

        except Exception as e:
            logger.error(f"Error in broadcast loop: {str(e)}")

        await asyncio.sleep(0.1)  # 100ms interval, same as original app

@app.websocket('/ws')
async def ws():
    """WebSocket endpoint for real-time data streaming"""
    client = websocket._get_current_object()
    connected_clients.add(client)
    logger.info(f"New WebSocket client connected. Total clients: {len(connected_clients)}")
    try:
        while True:
            try:
                message = await client.receive()
                logger.debug(f"Received message from client: {message}")
            except Exception as e:
                logger.error(f"WebSocket error: {str(e)}")
                break
    finally:
        connected_clients.remove(client)
        logger.info(f"Client disconnected. Remaining clients: {len(connected_clients)}")

@app.before_serving
async def startup():
    """Initialize mock server"""
    app.broadcast_task = asyncio.create_task(broadcast_mock_data())
    logger.info("Mock server started successfully")

@app.after_serving
async def shutdown():
    """Cleanup mock server"""
    if hasattr(app, 'broadcast_task'):
        app.broadcast_task.cancel()
    logger.info("Mock server shutdown completed")

if __name__ == "__main__":
    logger.info("Starting mock server on port 8000...")
    app.run(host='0.0.0.0', port=8000)