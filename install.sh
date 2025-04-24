#!/bin/bash

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install requirements
pip install -r backend/requirements.txt

# Enable I2C if not already enabled (Raspberry Pi)
if [ -f /etc/modules ]; then
    if ! grep -q "i2c-dev" /etc/modules; then
        echo "i2c-dev" | sudo tee -a /etc/modules
    fi
fi

if [ -f /boot/config.txt ]; then
    if ! grep -q "dtparam=i2c_arm=on" /boot/config.txt; then
        echo "dtparam=i2c_arm=on" | sudo tee -a /boot/config.txt
    fi
fi

# Create database directory if it doesn't exist
mkdir -p backend/data

echo "Installation complete! You can now run ./start.sh to start the application." 