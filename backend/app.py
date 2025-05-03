from quart import Quart, websocket, jsonify
import asyncio
import json
from datetime import datetime
from mpu6050 import MPU6050
from behavior_model import BehaviorPredictor
from database import DatabaseManager
import logging
import sys
from enum import Enum
from dataclasses import dataclass
from typing import Dict, Any, Optional
from obd1 import OBDInterface  # Import the new OBDInterface class
import os
import threading
from quart_cors import cors
import queue
import time

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
app = cors(app, allow_origin="*")

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

# Initialize OBD interface with the new implementation
try:
    obd_interface = OBDInterface()
    if obd_interface.connect():
        logger.info("OBD connection established successfully")
    else:
        logger.error("Failed to establish OBD connection")
        obd_interface = None
except Exception as e:
    logger.error(f"Failed to initialize OBD connection: {str(e)}")
    obd_interface = None

# Initialize behavior predictor
model_path = os.path.join(os.path.dirname(__file__), 'model-defended.h5')
if os.path.exists(model_path):
    logger.info(f"Behavior model file found at {model_path}, loading model.")
    behavior_predictor = BehaviorPredictor(model_path=model_path)
else:
    logger.error(f"Behavior model file not found at {model_path}. Cannot start BehaviorPredictor.")
    raise FileNotFoundError(f"Behavior model file not found at {model_path}")

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
    system_health.obd_connection_ok = obd_interface is not None and obd_interface.is_connected()
    
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
    global mpu_sensor, obd_interface
    
    logger.error(f"{component} error: {str(error)}")
    await update_system_health("hardware", str(error))
    
    if component == "MPU6050" and mpu_sensor:
        for attempt in range(HARDWARE_RETRY_ATTEMPTS):
            try:
                logger.info(f"MPU6050 reset attempt {attempt+1}/{HARDWARE_RETRY_ATTEMPTS}")
                mpu_sensor.reset()
                # Verify the sensor is working by attempting to get data
                test_data = mpu_sensor.get_data()
                logger.info(f"MPU6050 reset successful, verified with data: {test_data['accelerometer']['x']:.2f}, {test_data['accelerometer']['y']:.2f}, {test_data['accelerometer']['z']:.2f}")
                return True
            except Exception as e:
                logger.error(f"Reset attempt {attempt+1} failed: {str(e)}")
                await asyncio.sleep(1)  # Add delay between attempts
                
        # All retry attempts failed, try to completely reinitialize the sensor
        logger.warning("All reset attempts failed, reinitializing MPU6050...")
        try:
            mpu_sensor = None
            await asyncio.sleep(1)  # Brief delay before reinitializing
            mpu_sensor = MPU6050()
            test_data = mpu_sensor.get_data()  # Verify it's working
            logger.info(f"MPU6050 reinitialization successful")
            return True
        except Exception as e:
            logger.error(f"Failed to reinitialize MPU6050: {str(e)}")
            mpu_sensor = None
    
    elif component == "OBD" and obd_interface:
        for attempt in range(HARDWARE_RETRY_ATTEMPTS):
            try:
                logger.info(f"OBD reconnection attempt {attempt+1}/{HARDWARE_RETRY_ATTEMPTS}")
                obd_interface.disconnect()
                await asyncio.sleep(1)  # Add delay before reconnection
                
                if obd_interface.connect():
                    # Verify connection by trying to get data
                    test_data = obd_interface.get_data()
                    if any(value is not None for value in test_data.values()):
                        logger.info(f"OBD reconnection successful, verified with data")
                        return True
                    else:
                        logger.warning("OBD reconnected but no data available")
                else:
                    logger.warning("OBD connection attempt failed")
            except Exception as e:
                logger.error(f"OBD reconnection attempt {attempt+1} failed: {str(e)}")
                await asyncio.sleep(2)  # Longer delay between attempts
        
        # All retry attempts failed, try to completely reinitialize
        logger.warning("All OBD reconnection attempts failed, reinitializing OBD interface...")
        try:
            obd_interface = None
            await asyncio.sleep(2)  # Brief delay before reinitializing
            obd_interface = OBDInterface()
            if obd_interface.connect():
                # Verify with data retrieval
                test_data = obd_interface.get_data()
                logger.info(f"OBD reinitialization successful")
                return True
            else:
                logger.error("OBD reinitialization failed")
        except Exception as e:
            logger.error(f"Failed to reinitialize OBD: {str(e)}")
            obd_interface = None
    
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

@app.route('/sessions/current/latest_data')
async def get_current_session_latest_data():
    """Return the latest sensor, OBD, and behavior data for the singleton session (cumulative)."""
    try:
        # Always use the singleton session
        session_id = get_or_create_singleton_session()
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            # Latest sensor data
            cursor.execute("SELECT * FROM sensor_data WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1", (session_id,))
            sensor_row = cursor.fetchone()
            if sensor_row:
                accelerometer = json.loads(sensor_row['accelerometer_data'])
                gyroscope = json.loads(sensor_row['gyroscope_data'])
            else:
                accelerometer = {'x': 0, 'y': 0, 'z': 0, 'absolute': 0}
                gyroscope = {'x': 0, 'y': 0, 'z': 0, 'absolute': 0}
            # Latest OBD data
            cursor.execute("SELECT * FROM obd_data WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1", (session_id,))
            obd_row = cursor.fetchone()
            if obd_row:
                obd_data = {
                    'rpm': obd_row['rpm'],
                    'speed': obd_row['speed'],
                    'throttle': obd_row['throttle_position'],
                    'engineLoad': obd_row['engine_load'],
                    'coolant': obd_row['coolant_temp'],
                    'battery': obd_row['voltage'],
                    'intake': obd_row['intake_pressure'] if 'intake_pressure' in obd_row.keys() else None
                }
            else:
                obd_data = {}
            # Latest behavior event
            cursor.execute("SELECT * FROM behavior_events WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1", (session_id,))
            behavior_row = cursor.fetchone()
            if behavior_row:
                behavior = {
                    'event': behavior_row['behavior_type'],
                    'confidence': behavior_row['confidence'] if behavior_row['confidence'] is not None else 0.95,
                    'timestamp': datetime.fromisoformat(behavior_row['timestamp']).timestamp() if behavior_row['timestamp'] else datetime.now().timestamp()
                }
            else:
                behavior = {'event': 'normal_driving', 'confidence': 0.95, 'timestamp': datetime.now().timestamp()}
        data = {
            'timestamp': datetime.now().isoformat(),
            'sensor_data': {'accelerometer': accelerometer, 'gyroscope': gyroscope},
            'obd_data': obd_data,
            'behavior': behavior,
            'system_health': {
                'status': system_health.status.value,
                'mpu_sensor_ok': system_health.mpu_sensor_ok,
                'obd_connection_ok': system_health.obd_connection_ok,
                'error_counts': system_health.error_count,
                'last_error': system_health.last_error
            },
            'session_id': session_id,
            'session_start_time': None  # Not used in frontend, can be filled if needed
        }
        logger.debug(f"latest_data response for singleton session {session_id}: {data}")
        return jsonify(data)
    except Exception as e:
        logger.error(f"Failed to get latest data for singleton session: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/sessions/current/behavior_summary')
async def get_current_session_behavior_summary():
    """Return the count of each behavior event type for the singleton session (cumulative)."""
    try:
        # Always use the singleton session
        session_id = get_or_create_singleton_session()
        logger.debug(f"Querying behavior summary for singleton session ID: {session_id}")
        with db_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT behavior_type, COUNT(*) as count
                FROM behavior_events
                WHERE session_id = ?
                GROUP BY behavior_type
            """, (session_id,))
            rows = cursor.fetchall()
            summary = {
                'aggressive_acceleration': 0,
                'normal_acceleration': 0,
                'aggressive_deceleration': 0,
                'normal_deceleration': 0,
                'aggressive_lane_change': 0,
                'normal_lane_change': 0
            }
            for row in rows:
                if row['behavior_type'] in summary:
                    summary[row['behavior_type']] = row['count']
        logger.debug(f"Behavior summary for singleton session {session_id}: {summary}")
        return jsonify(summary)
    except Exception as e:
        logger.error(f"Failed to get behavior summary for singleton session: {str(e)}")
        return jsonify({'error': str(e)}), 500

def get_or_create_singleton_session():
    """Always use the first session ever created, or create one if none exists."""
    with db_manager.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM riding_sessions ORDER BY id ASC LIMIT 1")
        row = cursor.fetchone()
        if row:
            return row['id']
        # No session exists, create one
        cursor.execute("INSERT INTO riding_sessions (start_time) VALUES (?)", (datetime.now(),))
        conn.commit()
        return cursor.lastrowid

async def broadcast_sensor_data():
    global current_session_id, mpu_sensor, obd_interface
    
    # Always use the singleton session
    try:
        current_session_id = get_or_create_singleton_session()
        logger.info(f"Using singleton session with ID: {current_session_id}")
    except Exception as e:
        logger.error(f"Failed to get or create singleton session: {str(e)}")
        current_session_id = None

    last_behavior_event = None
    while True:
        if not connected_clients:
            await asyncio.sleep(0.1)
            continue

        try:
            sensor_data = None
            obd_data = {}
            
            # Get MPU6050 data with improved error handling
            if mpu_sensor and mpu_sensor.is_initialized:
                try:
                    raw_sensor_data = mpu_sensor.get_data()
                    # Calculate absolute acceleration and gyroscope if not present
                    acc = raw_sensor_data['accelerometer']
                    gyro = raw_sensor_data['gyroscope']
                    abs_acc = acc.get('absolute')
                    if abs_acc is None:
                        abs_acc = (acc['x']**2 + acc['y']**2 + acc['z']**2) ** 0.5
                    abs_gyro = gyro.get('absolute')
                    if abs_gyro is None:
                        abs_gyro = (gyro['x']**2 + gyro['y']**2 + gyro['z']**2) ** 0.5
                    sensor_data = {
                        'accelerometer': {
                            'x': acc['x'],
                            'y': acc['y'],
                            'z': acc['z'],
                            'absolute': abs_acc
                        },
                        'gyroscope': {
                            'x': gyro['x'],
                            'y': gyro['y'],
                            'z': gyro['z'],
                            'absolute': abs_gyro
                        }
                    }
                    if current_session_id:
                        db_manager.store_sensor_data(
                            current_session_id,
                            sensor_data['accelerometer'],
                            sensor_data['gyroscope']
                        )
                    # Get speed from OBD data (in m/s)
                    speed_kph = None
                    if obd_interface and obd_interface.is_connected():
                        try:
                            raw_obd_data = obd_interface.get_data()
                            speed_kph = raw_obd_data.get('SPEED')
                        except Exception as e:
                            logger.error(f"Error getting OBD data for speed: {str(e)}")
                    speed_mps = speed_kph * 1000 / 3600 if speed_kph is not None else 0.0
                    # Add data to behavior predictor for real-time prediction
                    behavior_predictor.add_data_point(sensor_data['accelerometer'], sensor_data['gyroscope'], speed_mps)
                except Exception as e:
                    logger.error(f"Error getting MPU6050 data: {str(e)}")
                    success = await handle_hardware_error("MPU6050", e)
                    if not success:
                        # If recovery failed, update system health and use default values
                        await update_system_health("hardware", f"MPU6050 recovery failed: {str(e)}")
                    # Use default values regardless of recovery success to keep the app running
                    sensor_data = {
                        'accelerometer': {'x': 0, 'y': 0, 'z': 0, 'absolute': 0},
                        'gyroscope': {'x': 0, 'y': 0, 'z': 0, 'absolute': 0}
                    }
            else:
                # No MPU sensor available or not initialized
                if mpu_sensor and not mpu_sensor.is_initialized:
                    logger.warning("MPU6050 is not initialized, attempting to initialize...")
                    try:
                        mpu_sensor.connect(mpu_sensor.bus_number)
                    except Exception as e:
                        logger.error(f"Failed to initialize MPU6050: {str(e)}")
                sensor_data = {
                    'accelerometer': {'x': 0, 'y': 0, 'z': 0, 'absolute': 0},
                    'gyroscope': {'x': 0, 'y': 0, 'z': 0, 'absolute': 0}
                }
            
            # Get OBD data with improved error handling
            raw_obd_data = {}
            if obd_interface and obd_interface.is_connected():
                try:
                    raw_obd_data = obd_interface.get_data()
                    
                    if current_session_id:
                        db_manager.store_obd_data(current_session_id, raw_obd_data)
                except Exception as e:
                    logger.error(f"Error getting OBD data: {str(e)}")
                    success = await handle_hardware_error("OBD", e)
                    if not success:
                        # If recovery failed, update system health
                        await update_system_health("hardware", f"OBD recovery failed: {str(e)}")
                    
                    # Use empty dictionary regardless of recovery success to keep the app running
                    raw_obd_data = {}
            else:
                # No OBD interface available or not connected
                if obd_interface and not obd_interface.is_connected():
                    logger.warning("OBD interface is not connected, attempting to connect...")
                    try:
                        obd_interface.connect()
                    except Exception as e:
                        logger.error(f"Failed to connect to OBD: {str(e)}")
                
                raw_obd_data = {}
            
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

            # Calculate behavior summary for the singleton session
            behavior_summary = {
                'aggressive_acceleration': 0,
                'normal_acceleration': 0,
                'aggressive_deceleration': 0,
                'normal_deceleration': 0,
                'aggressive_lane_change': 0,
                'normal_lane_change': 0
            }
            try:
                with db_manager.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        SELECT behavior_type, COUNT(*) as count
                        FROM behavior_events
                        WHERE session_id = ?
                        GROUP BY behavior_type
                    """, (current_session_id,))
                    rows = cursor.fetchall()
                    for row in rows:
                        if row['behavior_type'] in behavior_summary:
                            behavior_summary[row['behavior_type']] = row['count']
            except Exception as e:
                logger.error(f"Failed to calculate behavior summary: {str(e)}")

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
                },
                'behavior_summary': behavior_summary
            }

            # Only broadcast if behavior is not 'rider_stopped', or if the last event was not 'rider_stopped'
            should_broadcast = False
            if behavior['event'] != 'rider_stopped':
                should_broadcast = True
            elif last_behavior_event != 'rider_stopped':
                should_broadcast = True
            # else: suppress repeated 'rider_stopped' broadcasts

            if should_broadcast:
                disconnected_clients = set()
                for client in connected_clients:
                    try:
                        await client.send(json.dumps(data))
                    except Exception as e:
                        logger.error(f"Error sending to client: {str(e)}")
                        disconnected_clients.add(client)
                connected_clients.difference_update(disconnected_clients)
                last_behavior_event = behavior['event']

        except Exception as e:
            logger.error(f"Critical error in broadcast loop: {str(e)}")
            await update_system_health("data", str(e))

        await asyncio.sleep(0.1)  # 100ms interval

@app.websocket('/ws')
async def ws():
    client = websocket._get_current_object()
    connected_clients.add(client)
    try:
        # Send the latest data immediately on connect
        try:
            session_id = get_or_create_singleton_session()
            with db_manager.get_connection() as conn:
                cursor = conn.cursor()
                # Latest sensor data
                cursor.execute("SELECT * FROM sensor_data WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1", (session_id,))
                sensor_row = cursor.fetchone()
                if sensor_row:
                    accelerometer = json.loads(sensor_row['accelerometer_data'])
                    gyroscope = json.loads(sensor_row['gyroscope_data'])
                else:
                    accelerometer = {'x': 0, 'y': 0, 'z': 0, 'absolute': 0}
                    gyroscope = {'x': 0, 'y': 0, 'z': 0, 'absolute': 0}
                # Latest OBD data
                cursor.execute("SELECT * FROM obd_data WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1", (session_id,))
                obd_row = cursor.fetchone()
                if obd_row:
                    obd_data = {
                        'rpm': obd_row['rpm'],
                        'speed': obd_row['speed'],
                        'throttle': obd_row['throttle_position'],
                        'engineLoad': obd_row['engine_load'],
                        'coolant': obd_row['coolant_temp'],
                        'battery': obd_row['voltage'],
                        'intake': obd_row['intake_pressure'] if 'intake_pressure' in obd_row.keys() else None
                    }
                else:
                    obd_data = {}
                # Latest behavior event
                cursor.execute("SELECT * FROM behavior_events WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1", (session_id,))
                behavior_row = cursor.fetchone()
                if behavior_row:
                    behavior = {
                        'event': behavior_row['behavior_type'],
                        'confidence': behavior_row['confidence'] if behavior_row['confidence'] is not None else 0.95,
                        'timestamp': datetime.fromisoformat(behavior_row['timestamp']).timestamp() if behavior_row['timestamp'] else datetime.now().timestamp()
                    }
                else:
                    behavior = {'event': 'normal_driving', 'confidence': 0.95, 'timestamp': datetime.now().timestamp()}
                # Behavior summary
                behavior_summary = {
                    'aggressive_acceleration': 0,
                    'normal_acceleration': 0,
                    'aggressive_deceleration': 0,
                    'normal_deceleration': 0,
                    'aggressive_lane_change': 0,
                    'normal_lane_change': 0
                }
                cursor.execute("""
                    SELECT behavior_type, COUNT(*) as count
                    FROM behavior_events
                    WHERE session_id = ?
                    GROUP BY behavior_type
                """, (session_id,))
                rows = cursor.fetchall()
                for row in rows:
                    if row['behavior_type'] in behavior_summary:
                        behavior_summary[row['behavior_type']] = row['count']
                # Compose the data dict
                data = {
                    'timestamp': datetime.now().isoformat(),
                    'sensor_data': {'accelerometer': accelerometer, 'gyroscope': gyroscope},
                    'obd_data': obd_data,
                    'behavior': behavior,
                    'system_health': {
                        'status': system_health.status.value,
                        'mpu_sensor_ok': system_health.mpu_sensor_ok,
                        'obd_connection_ok': system_health.obd_connection_ok,
                        'error_counts': system_health.error_count,
                        'last_error': system_health.last_error
                    },
                    'behavior_summary': behavior_summary
                }
                await client.send(json.dumps(data))
        except Exception as e:
            logger.error(f"Failed to send initial data to new WebSocket client: {str(e)}")
        # Now enter the normal receive loop
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
    """Cleanup with error handling (no session ending)."""
    try:
        if hasattr(app, 'broadcast_task'):
            app.broadcast_task.cancel()
        if obd_interface:
            obd_interface.disconnect()
        if behavior_predictor:
            behavior_predictor.stop()
        logger.info("Application shutdown completed")
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}")

# Thread-safe queue for log batching
log_queue = queue.Queue()

# Batch log worker
def log_worker():
    while True:
        batch = []
        try:
            # Wait for at least one log
            log = log_queue.get(timeout=0.5)
            batch.append(log)
            # Gather more logs if available (up to 100 per batch)
            while not log_queue.empty() and len(batch) < 100:
                batch.append(log_queue.get_nowait())
        except queue.Empty:
            pass
        if batch:
            try:
                with db_manager.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.executemany(
                        "INSERT INTO logs (timestamp, level, message, source) VALUES (?, ?, ?, ?)",
                        batch
                    )
                    conn.commit()
            except Exception as e:
                print(f"Failed to batch log: {e}")

# Start the log worker thread
threading.Thread(target=log_worker, daemon=True).start()

class DBLogHandler(logging.Handler):
    def emit(self, record):
        try:
            msg = self.format(record)
            # Enqueue log for batch writing
            log_queue.put((datetime.now(), record.levelname, msg, record.name))
        except Exception as e:
            # Avoid recursion if queueing fails
            pass

# Add DBLogHandler to root logger
if not any(isinstance(h, DBLogHandler) for h in logging.getLogger().handlers):
    db_log_handler = DBLogHandler()
    db_log_handler.setLevel(logging.DEBUG)
    db_log_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    logging.getLogger().addHandler(db_log_handler)

@app.route('/logs')
async def get_logs():
    """Get recent logs from the database"""
    try:
        limit = int((await app.request.args.get('limit', 100)))
        level = app.request.args.get('level')
        logs = db_manager.get_logs(limit=limit, level=level)
        return jsonify(logs)
    except Exception as e:
        logger.error(f"Failed to get logs: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=8000)
