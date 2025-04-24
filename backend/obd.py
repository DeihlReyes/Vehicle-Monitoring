# obd.py
import asyncio
import obd

# Define the async OBD function to get data
async def get_obd_data():
    # Setup OBD connection (use your specific interface)
    connection = obd.OBD()  # Assuming you're using an OBD library that supports async or can be wrapped
    commands = [
        obd.commands.SPEED,
        obd.commands.RPM,
        obd.commands.THROTTLE_POS,
        obd.commands.ENGINE_LOAD,
        obd.commands.COOLANT_TEMP,
        obd.commands.INTAKE_TEMP,
        obd.commands.FUEL_STATUS
    ]
    
    # Use asyncio to fetch data concurrently for better performance
    async def fetch_data(command):
        response = connection.query(command)
        return response.value if response.is_null() is False else None
    
    # Fetch all data concurrently
    tasks = [fetch_data(command) for command in commands]
    results = await asyncio.gather(*tasks)
    
    # Map results to corresponding OBD commands
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
