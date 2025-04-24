#!/bin/bash

# Change to the script's directory
cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Start the backend server
cd backend
python app.py &

# Wait for the server to start
sleep 5

# Start the browser in kiosk mode
chromium-browser --kiosk --incognito --noerrdialogs --disable-translate http://localhost:5000

# If browser is closed, kill the backend server
kill $(lsof -t -i:5000) 