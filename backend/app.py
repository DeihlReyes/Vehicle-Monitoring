from quart import Quart, websocket
import asyncio
import json
from datetime import datetime
import obd
from mpu6050 import MPU6050
from behavior_model import BehaviorPredictor
import logging

# Configure logging
logging.basicConfig(level=logging.INFO,
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Quart(__name__)

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

async def broadcast_sensor_data():
    while True:
        if not connected_clients:
            await asyncio.sleep(0.1)
            continue

        try:
            # Get MPU6050 data
            if mpu_sensor:
                sensor_data = mpu_sensor.get_data()
                behavior_predictor.add_data_point(
                    sensor_data['accelerometer'],
                    sensor_data['gyroscope']
                )
            else:
                sensor_data = {
                    'accelerometer': {'x': 0, 'y': 0, 'z': 0},
                    'gyroscope': {'x': 0, 'y': 0, 'z': 0}
                }

            # Get OBD data
            obd_data = {}
            if obd_connection:
                for command in watched_commands:
                    response = obd_connection.query(command)
                    if response.value is not None:
                        obd_data[command.name] = response.value.magnitude
                    else:
                        obd_data[command.name] = None

            # Get behavior prediction
            behavior_data = behavior_predictor.get_latest_prediction()

            # Combine all data
            data = {
                'timestamp': datetime.now().isoformat(),
                'sensor_data': sensor_data,
                'obd_data': obd_data,
                'behavior': behavior_data
            }

            # Broadcast to all connected clients
            for client in connected_clients:
                try:
                    await client.send(json.dumps(data))
                except Exception as e:
                    logger.error(f"Error sending to client: {str(e)}")
                    connected_clients.remove(client)

        except Exception as e:
            logger.error(f"Error in broadcast loop: {str(e)}")

        await asyncio.sleep(0.1)  # 100ms interval

@app.websocket('/ws')
async def ws():
    client = websocket._get_current_object()
    connected_clients.add(client)
    try:
        while True:
            # Keep the connection alive
            await client.receive()
    except:
        connected_clients.remove(client)

@app.before_serving
async def startup():
    app.broadcast_task = asyncio.create_task(broadcast_sensor_data())

@app.after_serving
async def shutdown():
    if hasattr(app, 'broadcast_task'):
        app.broadcast_task.cancel()
    if obd_connection:
        obd_connection.stop()
    if behavior_predictor:
        behavior_predictor.stop()

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)
