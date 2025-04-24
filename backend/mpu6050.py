from smbus2 import SMBus
import math
import time

class MPU6050:
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

    def __init__(self, bus=1, device_address=0x68):
        self.bus = SMBus(bus)
        self.device_address = device_address
        self.setup()

    def setup(self):
        # Write to power management register
        self.bus.write_byte_data(self.device_address, self.POWER_MGMT_1, 0)
        
        # Configure sampling rate, filter settings and gyro/accel range
        self.bus.write_byte_data(self.device_address, self.SMPLRT_DIV, 7)
        self.bus.write_byte_data(self.device_address, self.CONFIG, 0)
        self.bus.write_byte_data(self.device_address, self.GYRO_CONFIG, 24)
        self.bus.write_byte_data(self.device_address, self.ACCEL_CONFIG, 24)

    def read_raw_data(self, addr):
        # Read raw 16-bit value
        high = self.bus.read_byte_data(self.device_address, addr)
        low = self.bus.read_byte_data(self.device_address, addr + 1)

        # Concatenate higher and lower value
        value = ((high << 8) | low)

        # Get signed value from raw value
        if value > 32768:
            value = value - 65536
        return value

    def get_data(self):
        # Read Accelerometer raw value
        acc_x = self.read_raw_data(self.ACCEL_XOUT_H)
        acc_y = self.read_raw_data(self.ACCEL_YOUT_H)
        acc_z = self.read_raw_data(self.ACCEL_ZOUT_H)

        # Read Gyroscope raw value
        gyro_x = self.read_raw_data(self.GYRO_XOUT_H)
        gyro_y = self.read_raw_data(self.GYRO_YOUT_H)
        gyro_z = self.read_raw_data(self.GYRO_ZOUT_H)

        # Full scale range ±2g and sensitivity scale factor
        Ax = acc_x / 16384.0  # Convert to actual accelerometer value in g
        Ay = acc_y / 16384.0
        Az = acc_z / 16384.0

        # Full scale range ±250°/s and sensitivity scale factor
        Gx = gyro_x / 131.0  # Convert to actual gyroscope value in °/s
        Gy = gyro_y / 131.0
        Gz = gyro_z / 131.0

        return {
            'accelerometer': {
                'x': round(Ax * 9.81, 3),  # Convert g to m/s²
                'y': round(Ay * 9.81, 3),
                'z': round(Az * 9.81, 3)
            },
            'gyroscope': {
                'x': round(Gx, 3),
                'y': round(Gy, 3),
                'z': round(Gz, 3)
            }
        } 