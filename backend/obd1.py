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
            obd.commands.INTAKE_PRESSURE,
            obd.commands.TIMING_ADVANCE
        ]
        
    def connect(self):
        """Establish connection to OBD-II adapter"""
        try:
            self.connection = obd.Async()
            
            # Watch each command individually
            self.connection.watch(obd.commands.SPEED)
            self.connection.watch(obd.commands.RPM)
            self.connection.watch(obd.commands.THROTTLE_POS)
            self.connection.watch(obd.commands.ENGINE_LOAD)
            self.connection.watch(obd.commands.COOLANT_TEMP)
            self.connection.watch(obd.commands.CONTROL_MODULE_VOLTAGE)
            self.connection.watch(obd.commands.FUEL_STATUS)
            self.connection.watch(obd.commands.O2_SENSORS)
            self.connection.watch(obd.commands.INTAKE_PRESSURE)
            self.connection.watch(obd.commands.TIMING_ADVANCE)
            
            # Start the connection
            self.connection.start()
            logger.info("OBD connection established successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize OBD connection: {str(e)}")
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
        """Get the latest data from all watched commands"""
        if not self.is_connected():
            return {cmd.name: None for cmd in self.commands}
        try:
            data = {}
            for cmd in self.commands:
                response = self.connection.query(cmd)
                value = response.value
                if value is not None:
                    # Handle value types
                    if hasattr(value, 'magnitude'):
                        data[cmd.name] = value.magnitude
                    elif isinstance(value, tuple):
                        # Store tuple as string or extract first element if appropriate
                        data[cmd.name] = str(value)
                    else:
                        data[cmd.name] = value
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
