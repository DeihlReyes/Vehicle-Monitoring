# obd.py
import asyncio
import backend.obd1 as obd1
import logging

logger = logging.getLogger(__name__)

class OBDInterface:
    def __init__(self):
        self.connection = None
        self.commands = [
            obd1.commands.SPEED,
            obd1.commands.RPM,
            obd1.commands.THROTTLE_POS,
            obd1.commands.ENGINE_LOAD,
            obd1.commands.COOLANT_TEMP,
            obd1.commands.CONTROL_MODULE_VOLTAGE,
            obd1.commands.FUEL_STATUS,
            obd1.commands.O2_SENSORS,
            obd1.commands.INTAKE_TEMP,
            obd1.commands.INTAKE_PRESSURE,
            obd1.commands.TIMING_ADVANCE,
            obd1.commands.BAROMETRIC_PRESSURE,
            obd1.commands.GET_DTC
        ]

    def connect(self):
        """Establish connection to OBD-II adapter using async and watch commands"""
        try:
            self.connection = obd1.Async()
            for cmd in self.commands:
                self.connection.watch(cmd)
            self.connection.start()
            logger.info("OBD connection established successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize OBD connection: {str(e)}")
            self.connection = None
            return False

    def disconnect(self):
        """Disconnect from OBD-II adapter"""
        if self.connection:
            self.connection.stop()
            self.connection = None

    def is_connected(self):
        """Check if the connection is active"""
        return self.connection is not None and self.connection.is_connected()

    def get_data(self):
        """Get the latest data from all watched commands, using the value extraction technique from app.py"""
        if not self.is_connected():
            return {cmd.name: None for cmd in self.commands}
        try:
            data = {}
            for cmd in self.commands:
                response = self.connection.query(cmd)
                # Handle special cases for value extraction
                if response.value is not None:
                    # For DTC, value is a list or None
                    if cmd == obd1.commands.GET_DTC:
                        data[cmd.name] = response.value if response.value else 'No errors detected'
                    # For O2_SENSORS, value may be a list
                    elif cmd == obd1.commands.O2_SENSORS:
                        data[cmd.name] = response.value
                    # For FUEL_STATUS, value may be a tuple
                    elif cmd == obd1.commands.FUEL_STATUS:
                        data[cmd.name] = response.value
                    # For all others, try to get magnitude
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
            return {cmd.name: None for cmd in self.commands}

    @staticmethod
    def get_fuel_status_description(status):
        # Check if status is a tuple
        if isinstance(status, tuple):
            primary_status = status[0]  # Extract the first element
        else:
            primary_status = status  # Use as is if not a tuple

        status_map = {
            "": "No Data",
            "Open loop due to insufficient engine temperature": "Cold Start",
            "Closed loop, using oxygen sensor feedback to determine fuel mix": "Normal Operation",
            "Open loop due to engine load OR fuel cut due to deceleration": "High Load",
            "Open loop due to system failure": "System Failure",
            "Closed loop, using at least one oxygen sensor but there is a fault in the feedback system": "Partial Feedback"
        }
        return status_map.get(primary_status, "Unknown Status")

    @staticmethod
    def calculate_o2_sensor_status(sensors):
        if sensors is None:
            return "Unknown (No sensors available)"
        # Flatten the input in case it's a nested list
        flat_sensors = [sensor for group in sensors for sensor in group] if any(isinstance(i, list) for i in sensors) else sensors
        total_sensors = len(flat_sensors)
        working_sensors = sum(flat_sensors)  # Count 'true' sensors
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

    def get_readable_data(self):
        """Return a dict with human-friendly OBD data for frontend or API use."""
        raw = self.get_data()
        return {
            'speed': raw.get('SPEED'),
            'rpm': raw.get('RPM'),
            'throttle_position': raw.get('THROTTLE_POS'),
            'engine_load': raw.get('ENGINE_LOAD'),
            'coolant_temp': raw.get('COOLANT_TEMP'),
            'control_module_voltage': raw.get('CONTROL_MODULE_VOLTAGE'),
            'fuel_status': self.get_fuel_status_description(raw.get('FUEL_STATUS')) if raw.get('FUEL_STATUS') is not None else 'Unknown',
            'o2_sensors': self.calculate_o2_sensor_status(raw.get('O2_SENSORS')) if raw.get('O2_SENSORS') is not None else 'Unknown',
            'intake_temp': raw.get('INTAKE_TEMP'),
            'intake_pressure': raw.get('INTAKE_PRESSURE'),
            'timing_advance': raw.get('TIMING_ADVANCE'),
            'barometric_pressure': raw.get('BAROMETRIC_PRESSURE'),
            'obd_error_message': 'No errors detected' if not raw.get('GET_DTC') else raw.get('GET_DTC')
        }

# Backward compatibility with the original async function
async def get_obd_data():
    """Legacy function for backward compatibility"""
    connection = obd1.OBD()
    commands = [
        obd1.commands.SPEED,
        obd1.commands.RPM,
        obd1.commands.THROTTLE_POS,
        obd1.commands.ENGINE_LOAD,
        obd1.commands.COOLANT_TEMP,
        obd1.commands.INTAKE_TEMP,
        obd1.commands.FUEL_STATUS
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
