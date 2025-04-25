from quart import Quart, websocket, jsonify
import asyncio
import json
from datetime import datetime
import obd
from mpu6050 import MPU6050
from behavior_model import BehaviorPredictor
from database import DatabaseManager
import logging
import sys
from enum import Enum
from dataclasses import dataclass
from typing import Dict, Any, Optional

# Error handling classes
class SensorError(Exception):
    """Base class for sensor-related errors"""
    pass

class HardwareError(SensorError):
    """Error related to hardware issues"""
    pass

class DataError(SensorError):
    """Error related to data validation"""
    pass

class SystemStatus(Enum):
    OK = "ok"
    WARNING = "warning"
    ERROR = "error"

@dataclass
class SystemHealth:
    status: SystemStatus
    mpu_sensor_ok: bool
    obd_connection_ok: bool
    last_error: Optional[str]
    error_count: Dict[str, int]

# Configure logging with more detailed format
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('vehicle_monitor.log')
    ]
)
logger = logging.getLogger(__name__)

# Global system health tracker
system_health = SystemHealth(
    status=SystemStatus.OK,
    mpu_sensor_ok=False,
    obd_connection_ok=False,
    last_error=None,
    error_count={"hardware": 0, "data": 0, "connection": 0}
)

app = Quart(__name__)

# Debug mode configuration
DEBUG_MODE = True  # Can be set via environment variable
HARDWARE_RETRY_ATTEMPTS = 3
DATA_VALIDATION_ENABLED = True

# Initialize database
db_manager = DatabaseManager()
current_session_id = None

# Initialize sensors and models
try:
    mpu_sensor = MPU6050()
    logger.info("MPU6050 sensor initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize MPU6050: {str(e)}")
    mpu_sensor = None

try:
    obd_connection = obd.Async()
    # Watch specific OBD commands
    watched_commands = [
        obd.commands.SPEED,
        obd.commands.RPM,
        obd.commands.THROTTLE_POS,
        obd.commands.ENGINE_LOAD,
        obd.commands.COOLANT_TEMP,
        obd.commands.CONTROL_MODULE_VOLTAGE,
        obd.commands.FUEL_STATUS,
        obd.commands.O2_SENSORS,
        obd.commands.INTAKE_PRESSURE,
        obd.commands.TIMING_ADVANCE
    ]
    
    for command in watched_commands:
        obd_connection.watch(command)
    
    obd_connection.start()
    logger.info("OBD connection established successfully")
except Exception as e:
    logger.error(f"Failed to initialize OBD connection: {str(e)}")
    obd_connection = None

# Initialize behavior predictor
behavior_predictor = BehaviorPredictor()

# Store connected WebSocket clients
connected_clients = set()

async def update_system_health(error_type: str = None, error_message: str = None):
    """Update system health status based on current state and errors"""
    global system_health
    
    if error_type:
        system_health.error_count[error_type] += 1
        system_health.last_error = error_message
    
    # Check component status
    system_health.mpu_sensor_ok = mpu_sensor is not None and getattr(mpu_sensor, 'is_initialized', False)
    system_health.obd_connection_ok = obd_connection is not None and obd_connection.is_connected()
    
    # Determine overall system status
    if system_health.error_count["hardware"] > 10 or system_health.error_count["data"] > 20:
        system_health.status = SystemStatus.ERROR
    elif system_health.error_count["hardware"] > 5 or system_health.error_count["data"] > 10:
        system_health.status = SystemStatus.WARNING
    elif system_health.mpu_sensor_ok and system_health.obd_connection_ok:
        system_health.status = SystemStatus.OK
    else:
        system_health.status = SystemStatus.WARNING

async def handle_hardware_error(component: str, error: Exception):
    """Handle hardware-related errors with retry logic"""
    global mpu_sensor, obd_connection
    
    logger.error(f"{component} error: {str(error)}")
    await update_system_health("hardware", str(error))
    
    if component == "MPU6050" and mpu_sensor:
        for _ in range(HARDWARE_RETRY_ATTEMPTS):
            try:
                mpu_sensor.reset()
                return True
            except Exception as e:
                logger.error(f"Failed to reset MPU6050: {str(e)}")
        mpu_sensor = None
    
    elif component == "OBD" and obd_connection:
        for _ in range(HARDWARE_RETRY_ATTEMPTS):
            try:
                obd_connection.close()
                obd_connection = obd.Async()
                obd_connection.start()
                return True
            except Exception as e:
                logger.error(f"Failed to reconnect OBD: {str(e)}")
        obd_connection = None
    
    return False

@app.route('/health')
async def health_check():
    """Endpoint to check system health status"""
    return jsonify({
        "status": system_health.status.value,
        "components": {
            "mpu_sensor": system_health.mpu_sensor_ok,
            "obd_connection": system_health.obd_connection_ok
        },
        "error_counts": system_health.error_count,
        "last_error": system_health.last_error
    })

@app.route('/sessions/recent')
async def get_recent_sessions():
    """Get recent riding sessions"""
    try:
        sessions = db_manager.get_recent_sessions()
        return jsonify([{
            'id': session.id,
            'start_time': session.start_time.isoformat(),
            'end_time': session.end_time.isoformat() if session.end_time else None,
            'total_aggressive_events': session.total_aggressive_events,
            'average_speed': session.average_speed,
            'max_speed': session.max_speed
        } for session in sessions])
    except Exception as e:
        logger.error(f"Failed to get recent sessions: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/sessions/<int:session_id>')
async def get_session_details(session_id: int):
    """Get detailed data for a specific session"""
    try:
        session_data = db_manager.get_session_data(session_id)
        return jsonify(session_data)
    except Exception as e:
        logger.error(f"Failed to get session {session_id} details: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/statistics/behavior')
async def get_behavior_stats():
    """Get behavior statistics for the last 7 days"""
    try:
        stats = db_manager.get_behavior_statistics()
        return jsonify(stats)
    except Exception as e:
        logger.error(f"Failed to get behavior statistics: {str(e)}")
        return jsonify({'error': str(e)}), 500

async def broadcast_sensor_data():
    global current_session_id
    
    # Start a new session
    try:
        current_session_id = db_manager.start_new_session()
        logger.info(f"Started new riding session with ID: {current_session_id}")
    except Exception as e:
        logger.error(f"Failed to start new session: {str(e)}")
        current_session_id = None

    while True:
        if not connected_clients:
            await asyncio.sleep(0.1)
            continue

        try:
            sensor_data = None
            obd_data = {}
            
            # Get MPU6050 data with error handling
            if mpu_sensor:
                try:
                    raw_sensor_data = mpu_sensor.get_data()
                    sensor_data = {
                        'accelerometer': {
                            'x': raw_sensor_data['accelerometer']['x'],
                            'y': raw_sensor_data['accelerometer']['y'],
                            'z': raw_sensor_data['accelerometer']['z']
                        },
                        'gyroscope': {
                            'x': raw_sensor_data['gyroscope']['x'],  # Use x, y, z instead of roll, pitch, yaw
                            'y': raw_sensor_data['gyroscope']['y'], 
                            'z': raw_sensor_data['gyroscope']['z']
                        }
                    }
                    if current_session_id:
                        db_manager.store_sensor_data(
                            current_session_id,
                            sensor_data['accelerometer'],
                            sensor_data['gyroscope']
                        )
                except Exception as e:
                    await handle_hardware_error("MPU6050", e)
                    sensor_data = {
                        'accelerometer': {'x': 0, 'y': 0, 'z': 0},
                        'gyroscope': {'x': 0, 'y': 0, 'z': 0}
                    }
            else:
                sensor_data = {
                    'accelerometer': {'x': 0, 'y': 0, 'z': 0},
                    'gyroscope': {'x': 0, 'y': 0, 'z': 0}
                }

            # Get OBD data with error handling
            raw_obd_data = {}
            if obd_connection and obd_connection.is_connected():
                try:
                    for command in watched_commands:
                        response = obd_connection.query(command)
                        if response.value is not None:
                            raw_obd_data[command.name] = response.value.magnitude
                        else:
                            raw_obd_data[command.name] = None
                    
                    if current_session_id:
                        db_manager.store_obd_data(current_session_id, raw_obd_data)
                except Exception as e:
                    await handle_hardware_error("OBD", e)
                    raw_obd_data = {cmd.name: None for cmd in watched_commands}
            else:
                raw_obd_data = {cmd.name: None for cmd in watched_commands}
            
            # Format OBD data for frontend
            obd_data = {
                'rpm': raw_obd_data.get('RPM'),
                'speed': raw_obd_data.get('SPEED'),
                'throttle': raw_obd_data.get('THROTTLE_POS'),
                'engineLoad': raw_obd_data.get('ENGINE_LOAD'),
                'coolant': raw_obd_data.get('COOLANT_TEMP'),
                'battery': raw_obd_data.get('CONTROL_MODULE_VOLTAGE'),
                'intake': raw_obd_data.get('INTAKE_PRESSURE')
            }

            # Get behavior prediction with error handling
            try:
                behavior_data = behavior_predictor.get_latest_prediction()
                # Format behavior data for frontend
                behavior = {
                    'event': behavior_data.get('behavior', 'normal_driving'),
                    'confidence': behavior_data.get('confidence', 0.95),
                    'timestamp': behavior_data.get('timestamp', datetime.now().timestamp())
                }
                
                if current_session_id and behavior['event'].startswith('aggressive'):
                    # Store aggressive behavior events
                    db_manager.store_behavior_event(current_session_id, behavior['event'])
            except Exception as e:
                logger.error(f"Behavior prediction error: {str(e)}")
                await update_system_health("data", str(e))
                behavior = {
                    'event': 'normal_driving',
                    'confidence': 0.95,
                    'timestamp': datetime.now().timestamp()
                }

            # Combine all data
            data = {
                'timestamp': datetime.now().isoformat(),
                'sensor_data': sensor_data,
                'obd_data': obd_data,
                'behavior': behavior,
                'system_health': {
                    'status': system_health.status.value,
                    'mpu_sensor_ok': system_health.mpu_sensor_ok,
                    'obd_connection_ok': system_health.obd_connection_ok,
                    'error_counts': system_health.error_count,
                    'last_error': system_health.last_error
                }
            }

            # Broadcast to all connected clients
            disconnected_clients = set()
            for client in connected_clients:
                try:
                    await client.send(json.dumps(data))
                except Exception as e:
                    logger.error(f"Error sending to client: {str(e)}")
                    disconnected_clients.add(client)
            
            # Remove disconnected clients
            connected_clients.difference_update(disconnected_clients)

        except Exception as e:
            logger.error(f"Critical error in broadcast loop: {str(e)}")
            await update_system_health("data", str(e))

        await asyncio.sleep(0.1)  # 100ms interval

@app.websocket('/ws')
async def ws():
    client = websocket._get_current_object()
    connected_clients.add(client)
    try:
        while True:
            try:
                # Keep the connection alive and handle incoming messages
                message = await client.receive()
                if DEBUG_MODE:
                    logger.debug(f"Received message from client: {message}")
            except Exception as e:
                logger.error(f"WebSocket error: {str(e)}")
                break
    finally:
        connected_clients.remove(client)

@app.before_serving
async def startup():
    """Initialize application with error handling"""
    try:
        app.broadcast_task = asyncio.create_task(broadcast_sensor_data())
        logger.info("Application started successfully")
    except Exception as e:
        logger.error(f"Failed to start application: {str(e)}")
        raise

@app.after_serving
async def shutdown():
    """Cleanup with error handling"""
    try:
        if hasattr(app, 'broadcast_task'):
            app.broadcast_task.cancel()
        if obd_connection:
            obd_connection.stop()
        if behavior_predictor:
            behavior_predictor.stop()
        if current_session_id:
            db_manager.end_session(current_session_id)
        logger.info("Application shutdown completed")
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8000)
