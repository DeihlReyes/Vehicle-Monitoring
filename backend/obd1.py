# obd.py
import asyncio
import obd
import logging
import time

logger = logging.getLogger(__name__)

# Set up the OBD connection globally
connection = None
watched_commands = [
    obd.commands.SPEED,
    obd.commands.RPM,
    obd.commands.THROTTLE_POS,
    obd.commands.ENGINE_LOAD,
    obd.commands.COOLANT_TEMP,
    obd.commands.CONTROL_MODULE_VOLTAGE,
    obd.commands.FUEL_STATUS,
    obd.commands.O2_SENSORS,
    obd.commands.INTAKE_TEMP,
    obd.commands.INTAKE_PRESSURE,
    obd.commands.TIMING_ADVANCE,
    obd.commands.BAROMETRIC_PRESSURE,
    obd.commands.GET_DTC
]

def ensure_connection():
    global connection
    if connection is None or not connection.is_connected():
        try:
            logger.warning("OBD connection lost or not established. Attempting to reconnect...")
            connection = obd.Async()
            for cmd in watched_commands:
                connection.watch(cmd)
            connection.start()
            # Give it a moment to connect
            time.sleep(1)
            if connection.is_connected():
                logger.info("OBD connection re-established successfully.")
            else:
                logger.error("Failed to re-establish OBD connection.")
        except Exception as e:
            logger.error(f"OBD reconnection failed: {str(e)}")
            connection = None

def calculate_o2_sensor_status(sensors):
    if sensors is None:
        return "Unknown (No sensors available)"
    flat_sensors = [sensor for group in sensors for sensor in group] if any(isinstance(i, list) for i in sensors) else sensors
    total_sensors = len(flat_sensors)
    working_sensors = sum(flat_sensors)
    if total_sensors == 0:
        return "Unknown (No sensors available)"
    percentage = (working_sensors / total_sensors) * 100
    if percentage == 100:
        status = "Excellent"
    elif percentage >= 75:
        status = "Good"
    elif percentage >= 50:
        status = "Fair"
    elif percentage > 0:
        status = "Poor"
    else:
        status = "Critical"
    return f"{percentage:.0f}% - {status}"

def get_fuel_status_description(status):
    if isinstance(status, tuple):
        primary_status = status[0]
    else:
        primary_status = status
    status_map = {
        "": "No Data",
        "Open loop due to insufficient engine temperature": "Cold Start",
        "Closed loop, using oxygen sensor feedback to determine fuel mix": "Normal Operation",
        "Open loop due to engine load OR fuel cut due to deceleration": "High Load",
        "Open loop due to system failure": "System Failure",
        "Closed loop, using at least one oxygen sensor but there is a fault in the feedback system": "Partial Feedback"
    }
    return status_map.get(primary_status, "Unknown Status")

def get_obd_data():
    ensure_connection()
    if connection is None or not connection.is_connected():
        logger.error("OBD is not connected. Returning error data.")
        return {cmd.name: None for cmd in watched_commands} | {"error": "OBD connection not established"}
    try:
        data = {}
        for cmd in watched_commands:
            response = connection.query(cmd)
            if response.is_null():
                data[cmd.name] = None
                continue
            if response.value is not None:
                if cmd == obd.commands.GET_DTC:
                    data[cmd.name] = response.value if response.value else 'No errors detected'
                elif cmd == obd.commands.O2_SENSORS:
                    data[cmd.name] = calculate_o2_sensor_status(response.value)
                elif cmd == obd.commands.FUEL_STATUS:
                    data[cmd.name] = get_fuel_status_description(response.value)
                else:
                    try:
                        data[cmd.name] = response.value.magnitude
                    except Exception:
                        data[cmd.name] = str(response.value)
            else:
                data[cmd.name] = None
        return data
    except Exception as e:
        logger.error(f"Error retrieving OBD data: {str(e)}")
        return {cmd.name: None for cmd in watched_commands} | {"error": str(e)}

# Backward compatibility with the original async function
async def get_obd_data():
    """Legacy function for backward compatibility"""
    connection = obd.OBD()
    commands = [
        obd.commands.SPEED,
        obd.commands.RPM,
        obd.commands.THROTTLE_POS,
        obd.commands.ENGINE_LOAD,
        obd.commands.COOLANT_TEMP,
        obd.commands.INTAKE_TEMP,
        obd.commands.FUEL_STATUS
    ]
    
    async def fetch_data(command):
        response = connection.query(command)
        return response.value if not response.is_null() else None
    
    tasks = [fetch_data(command) for command in commands]
    results = await asyncio.gather(*tasks)
    
    obd_data = {
        "speed": results[0],
        "rpm": results[1],
        "throttle_position": results[2],
        "engine_load": results[3],
        "coolant_temp": results[4],
        "intake_temp": results[5],
        "fuel_status": results[6]
    }
    return obd_data
