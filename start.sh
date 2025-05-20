#!/bin/bash

# Change to the script's directory
cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Start the backend server
cd backend
python app.py &

# Wait a bit for backend to initialize
sleep 2

# Start the frontend server
cd ../frontend
python server.py &

# Keep the script running
wait 