import math
import time
import logging
import platform
import random
from typing import Dict, Any, Optional
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

class MPU6050Error(Exception):
    """Base exception for MPU6050 errors"""
    pass

class MPU6050Base(ABC):
    # MPU6050 Registers and their Address
    POWER_MGMT_1 = 0x6B
    SMPLRT_DIV = 0x19
    CONFIG = 0x1A
    GYRO_CONFIG = 0x1B
    ACCEL_CONFIG = 0x1C
    ACCEL_XOUT_H = 0x3B
    ACCEL_YOUT_H = 0x3D
    ACCEL_ZOUT_H = 0x3F
    GYRO_XOUT_H = 0x43
    GYRO_YOUT_H = 0x45
    GYRO_ZOUT_H = 0x47

    # Validation thresholds
    MAX_ACCEL = 16  # Maximum acceleration in g
    MAX_GYRO = 2000  # Maximum angular velocity in degrees/s

    def __init__(self):
        self.is_initialized = False

    @abstractmethod
    def connect(self, bus: int) -> None:
        pass

    @abstractmethod
    def setup(self) -> None:
        pass

    @abstractmethod
    def get_data(self) -> Dict[str, Dict[str, float]]:
        pass

    @abstractmethod
    def reset(self) -> None:
        pass

    def validate_sensor_data(self, data: Dict[str, Dict[str, float]]) -> bool:
        """Validate sensor data is within expected ranges"""
        try:
            # Check accelerometer data
            for axis, value in data['accelerometer'].items():
                if abs(value) > (self.MAX_ACCEL * 9.81):  # Convert g to m/s²
                    logger.warning(f"Accelerometer {axis}-axis value {value} exceeds maximum threshold")
                    return False

            # Check gyroscope data
            for axis, value in data['gyroscope'].items():
                if abs(value) > self.MAX_GYRO:
                    logger.warning(f"Gyroscope {axis}-axis value {value} exceeds maximum threshold")
                    return False

            return True
        except Exception as e:
            logger.error(f"Data validation error: {str(e)}")
            return False

class MPU6050Mock(MPU6050Base):
    """Mock implementation of MPU6050 for Windows development"""
    
    def __init__(self, bus=1, device_address=0x68, retry_attempts=3):
        super().__init__()
        self.device_address = device_address
        self.retry_attempts = retry_attempts
        self.connect(bus)
        
    def connect(self, bus: int) -> None:
        """Simulate connection to the MPU6050"""
        try:
            self.setup()
            self.is_initialized = True
            logger.info("Mock MPU6050 initialized successfully")
        except Exception as e:
            raise MPU6050Error(f"Failed to initialize mock MPU6050: {str(e)}") from e

    def setup(self) -> None:
        """Simulate device setup"""
        time.sleep(0.1)  # Simulate setup time
        pass

    def get_data(self) -> Dict[str, Dict[str, float]]:
        """Generate simulated sensor data"""
        if not self.is_initialized:
            raise MPU6050Error("Device not initialized")

        try:
            # Generate realistic-looking mock data
            data = {
                'accelerometer': {
                    'x': round(random.uniform(-2, 2) * 9.81, 3),  # Simulate typical driving acceleration
                    'y': round(random.uniform(-1, 1) * 9.81, 3),
                    'z': round(-9.81 + random.uniform(-0.5, 0.5), 3)  # Mostly gravity with some noise
                },
                'gyroscope': {
                    'x': round(random.uniform(-45, 45), 3),  # Simulate typical rotation rates
                    'y': round(random.uniform(-45, 45), 3),
                    'z': round(random.uniform(-20, 20), 3)
                }
            }

            if not self.validate_sensor_data(data):
                raise MPU6050Error("Sensor data validation failed")

            return data

        except Exception as e:
            logger.error(f"Error getting sensor data: {str(e)}")
            raise MPU6050Error("Failed to get sensor data") from e

    def reset(self) -> None:
        """Simulate device reset"""
        time.sleep(0.1)  # Simulate reset time
        self.setup()
        logger.info("Mock MPU6050 reset successful")

class MPU6050Hardware(MPU6050Base):
    """Real hardware implementation of MPU6050 for Linux systems"""
    
    def __init__(self, bus=1, device_address=0x68, retry_attempts=3):
        super().__init__()
        self.bus = None
        self.device_address = device_address
        self.retry_attempts = retry_attempts
        self.connect(bus)

    def connect(self, bus: int) -> None:
        """Attempt to connect to the MPU6050 with retry logic"""
        from smbus2 import SMBus
        for attempt in range(self.retry_attempts):
            try:
                self.bus = SMBus(bus)
                self.setup()
                self.is_initialized = True
                logger.info("MPU6050 initialized successfully")
                return
            except Exception as e:
                logger.error(f"Attempt {attempt + 1}/{self.retry_attempts} to initialize MPU6050 failed: {str(e)}")
                if attempt < self.retry_attempts - 1:
                    time.sleep(1)  # Wait before retrying
                else:
                    raise MPU6050Error(f"Failed to initialize MPU6050 after {self.retry_attempts} attempts") from e

    def setup(self) -> None:
        """Initialize the MPU6050 with error handling"""
        try:
            # Write to power management register
            self.bus.write_byte_data(self.device_address, self.POWER_MGMT_1, 0)
            time.sleep(0.1)  # Wait for device to stabilize
            
            # Configure sampling rate, filter settings and gyro/accel range
            self.bus.write_byte_data(self.device_address, self.SMPLRT_DIV, 7)
            self.bus.write_byte_data(self.device_address, self.CONFIG, 0)
            self.bus.write_byte_data(self.device_address, self.GYRO_CONFIG, 24)
            self.bus.write_byte_data(self.device_address, self.ACCEL_CONFIG, 24)
            
            # Verify setup by reading back configuration
            if self.bus.read_byte_data(self.device_address, self.POWER_MGMT_1) != 0:
                raise MPU6050Error("Failed to configure power management")
        except Exception as e:
            raise MPU6050Error(f"Setup failed: {str(e)}") from e

    def read_raw_data(self, addr: int) -> int:
        """Read raw data with error handling and validation"""
        try:
            high = self.bus.read_byte_data(self.device_address, addr)
            low = self.bus.read_byte_data(self.device_address, addr + 1)
            
            value = ((high << 8) | low)
            if value > 32768:
                value = value - 65536
            return value
        except Exception as e:
            raise MPU6050Error(f"Failed to read data from address {hex(addr)}: {str(e)}") from e

    def get_data(self) -> Dict[str, Dict[str, float]]:
        """Get sensor data with validation and error handling"""
        if not self.is_initialized:
            raise MPU6050Error("Device not initialized")

        try:
            # Read Accelerometer raw value
            acc_x = self.read_raw_data(self.ACCEL_XOUT_H)
            acc_y = self.read_raw_data(self.ACCEL_YOUT_H)
            acc_z = self.read_raw_data(self.ACCEL_ZOUT_H)

            # Read Gyroscope raw value
            gyro_x = self.read_raw_data(self.GYRO_XOUT_H)
            gyro_y = self.read_raw_data(self.GYRO_YOUT_H)
            gyro_z = self.read_raw_data(self.GYRO_ZOUT_H)

            # Convert to actual values
            data = {
                'accelerometer': {
                    'x': round(acc_x / 16384.0 * 9.81, 3),  # Convert to m/s²
                    'y': round(acc_y / 16384.0 * 9.81, 3),
                    'z': round(acc_z / 16384.0 * 9.81, 3)
                },
                'gyroscope': {
                    'x': round(gyro_x / 131.0, 3),  # degrees/s
                    'y': round(gyro_y / 131.0, 3),
                    'z': round(gyro_z / 131.0, 3)
                }
            }

            if not self.validate_sensor_data(data):
                raise MPU6050Error("Sensor data validation failed")

            return data

        except Exception as e:
            logger.error(f"Error getting sensor data: {str(e)}")
            raise MPU6050Error("Failed to get sensor data") from e

    def reset(self) -> None:
        """Reset the device if it becomes unresponsive"""
        try:
            self.bus.write_byte_data(self.device_address, self.POWER_MGMT_1, 0x80)  # Reset all registers
            time.sleep(0.1)
            self.setup()
            logger.info("MPU6050 reset successful")
        except Exception as e:
            logger.error(f"Failed to reset MPU6050: {str(e)}")
            raise MPU6050Error("Reset failed") from e

def MPU6050(bus=1, device_address=0x68, retry_attempts=3):
    """Factory function to create the appropriate MPU6050 instance based on the platform"""
    if platform.system() == 'Windows':
        logger.info("Running on Windows - using mock MPU6050 implementation")
        return MPU6050Mock(bus, device_address, retry_attempts)
    else:
        logger.info("Running on Linux - using hardware MPU6050 implementation")
        return MPU6050Hardware(bus, device_address, retry_attempts) 