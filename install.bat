@echo off

REM Create and activate virtual environment
python -m venv venv
call venv\Scripts\activate.bat

REM Upgrade pip
python -m pip install --upgrade pip

REM Install requirements
pip install -r backend\requirements.txt

REM Create database directory if it doesn't exist
if not exist "backend\data" mkdir backend\data

echo Installation complete! You can now run start.bat to start the application.
pause 