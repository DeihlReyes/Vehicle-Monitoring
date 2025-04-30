# obd.py
import asyncio
import obd
import logging

logger = logging.getLogger(__name__)

class OBDInterface:
    def __init__(self):
        self.connection = None
        self.commands = [
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

    def connect(self):
        """Establish connection to OBD-II adapter using async and watch commands"""
        try:
            self.connection = obd.Async()
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
                    if cmd == obd.commands.GET_DTC:
                        data[cmd.name] = response.value if response.value else 'No errors detected'
                    # For O2_SENSORS, value may be a list
                    elif cmd == obd.commands.O2_SENSORS:
                        data[cmd.name] = response.value
                    # For FUEL_STATUS, value may be a tuple
                    elif cmd == obd.commands.FUEL_STATUS:
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
