import sqlite3
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import json

logger = logging.getLogger(__name__)

@dataclass
class RidingSession:
    id: int
    start_time: datetime
    end_time: Optional[datetime]
    total_aggressive_events: int
    average_speed: float
    max_speed: float

class DatabaseManager:
    def __init__(self, db_path: str = "vehicle_data.db"):
        self.db_path = db_path
        self.initialize_database()

    def get_connection(self):
        """Create a database connection with error handling, WAL mode, and higher timeout"""
        try:
            conn = sqlite3.connect(self.db_path, timeout=30)
            conn.row_factory = sqlite3.Row  # Enable row factory for named columns
            # Enable WAL mode for better concurrency
            conn.execute("PRAGMA journal_mode=WAL;")
            return conn
        except Exception as e:
            logger.error(f"Failed to connect to database: {str(e)}")
            raise

    def initialize_database(self):
        """Create necessary tables if they don't exist"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Create riding sessions table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS riding_sessions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        start_time TIMESTAMP NOT NULL,
                        end_time TIMESTAMP,
                        total_aggressive_events INTEGER DEFAULT 0,
                        average_speed REAL DEFAULT 0,
                        max_speed REAL DEFAULT 0
                    )
                """)

                # Create sensor data table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS sensor_data (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id INTEGER,
                        timestamp TIMESTAMP NOT NULL,
                        accelerometer_data TEXT NOT NULL,
                        gyroscope_data TEXT NOT NULL,
                        FOREIGN KEY (session_id) REFERENCES riding_sessions(id)
                    )
                """)

                # Create OBD data table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS obd_data (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id INTEGER,
                        timestamp TIMESTAMP NOT NULL,
                        speed REAL,
                        rpm REAL,
                        throttle_position REAL,
                        engine_load REAL,
                        coolant_temp REAL,
                        voltage REAL,
                        FOREIGN KEY (session_id) REFERENCES riding_sessions(id)
                    )
                """)

                # Create behavior events table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS behavior_events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id INTEGER,
                        timestamp TIMESTAMP NOT NULL,
                        behavior_type TEXT NOT NULL,
                        confidence REAL,
                        FOREIGN KEY (session_id) REFERENCES riding_sessions(id)
                    )
                """)

                # Create logs table
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp TIMESTAMP NOT NULL,
                        level TEXT NOT NULL,
                        message TEXT NOT NULL,
                        source TEXT
                    )
                """)

                conn.commit()
                logger.info("Database initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize database: {str(e)}")
            raise

    def start_new_session(self) -> int:
        """Start a new riding session and return its ID"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO riding_sessions (start_time) VALUES (?)",
                    (datetime.now(),)
                )
                session_id = cursor.lastrowid
                logger.info(f"Started new riding session with ID: {session_id}")
                return session_id
        except Exception as e:
            logger.error(f"Failed to start new session: {str(e)}")
            raise

    def end_session(self, session_id: int):
        """End a riding session and calculate summary statistics"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Calculate session statistics
                cursor.execute("""
                    UPDATE riding_sessions 
                    SET end_time = ?,
                        total_aggressive_events = (
                            SELECT COUNT(*) FROM behavior_events 
                            WHERE session_id = ? AND behavior_type LIKE 'aggressive%'
                        ),
                        average_speed = (
                            SELECT AVG(speed) FROM obd_data 
                            WHERE session_id = ? AND speed IS NOT NULL
                        ),
                        max_speed = (
                            SELECT MAX(speed) FROM obd_data 
                            WHERE session_id = ? AND speed IS NOT NULL
                        )
                    WHERE id = ?
                """, (datetime.now(), session_id, session_id, session_id, session_id))
                
                conn.commit()
                logger.info(f"Ended riding session {session_id}")
        except Exception as e:
            logger.error(f"Failed to end session {session_id}: {str(e)}")
            raise

    def store_sensor_data(self, session_id: int, accelerometer: Dict, gyroscope: Dict):
        """Store sensor readings in the database"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO sensor_data (session_id, timestamp, accelerometer_data, gyroscope_data) VALUES (?, ?, ?, ?)",
                    (session_id, datetime.now(), json.dumps(accelerometer), json.dumps(gyroscope))
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to store sensor data: {str(e)}")
            raise

    def store_obd_data(self, session_id: int, obd_data: Dict[str, float]):
        """Store OBD readings in the database"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """INSERT INTO obd_data (
                        session_id, timestamp, speed, rpm, throttle_position,
                        engine_load, coolant_temp, voltage
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        session_id,
                        datetime.now(),
                        obd_data.get('SPEED'),
                        obd_data.get('RPM'),
                        obd_data.get('THROTTLE_POS'),
                        obd_data.get('ENGINE_LOAD'),
                        obd_data.get('COOLANT_TEMP'),
                        obd_data.get('CONTROL_MODULE_VOLTAGE')
                    )
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to store OBD data: {str(e)}")
            raise

    def store_behavior_event(self, session_id: int, behavior_type: str, confidence: float = 1.0):
        """Store a detected behavior event"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO behavior_events (session_id, timestamp, behavior_type, confidence) VALUES (?, ?, ?, ?)",
                    (session_id, datetime.now(), behavior_type, confidence)
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to store behavior event: {str(e)}")
            raise

    def get_session_summary(self, session_id: int) -> Optional[RidingSession]:
        """Get summary of a specific riding session"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM riding_sessions WHERE id = ?", (session_id,))
                row = cursor.fetchone()
                if row:
                    return RidingSession(
                        id=row['id'],
                        start_time=datetime.fromisoformat(row['start_time']),
                        end_time=datetime.fromisoformat(row['end_time']) if row['end_time'] else None,
                        total_aggressive_events=row['total_aggressive_events'],
                        average_speed=row['average_speed'],
                        max_speed=row['max_speed']
                    )
                return None
        except Exception as e:
            logger.error(f"Failed to get session summary: {str(e)}")
            raise

    def get_recent_sessions(self, limit: int = 10) -> List[RidingSession]:
        """Get summaries of recent riding sessions"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT * FROM riding_sessions ORDER BY start_time DESC LIMIT ?",
                    (limit,)
                )
                return [
                    RidingSession(
                        id=row['id'],
                        start_time=datetime.fromisoformat(row['start_time']),
                        end_time=datetime.fromisoformat(row['end_time']) if row['end_time'] else None,
                        total_aggressive_events=row['total_aggressive_events'],
                        average_speed=row['average_speed'],
                        max_speed=row['max_speed']
                    )
                    for row in cursor.fetchall()
                ]
        except Exception as e:
            logger.error(f"Failed to get recent sessions: {str(e)}")
            raise

    def get_behavior_statistics(self, days: int = 7) -> Dict[str, int]:
        """Get behavior statistics for the specified time period"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT behavior_type, COUNT(*) as count
                    FROM behavior_events
                    WHERE timestamp >= datetime('now', ?)
                    GROUP BY behavior_type
                """, (f'-{days} days',))
                return {row['behavior_type']: row['count'] for row in cursor.fetchall()}
        except Exception as e:
            logger.error(f"Failed to get behavior statistics: {str(e)}")
            raise

    def get_session_data(self, session_id: int) -> Dict[str, Any]:
        """Get all data for a specific session"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                
                # Get session info
                cursor.execute("SELECT * FROM riding_sessions WHERE id = ?", (session_id,))
                session = cursor.fetchone()
                
                # Get sensor data
                cursor.execute("SELECT * FROM sensor_data WHERE session_id = ?", (session_id,))
                sensor_data = cursor.fetchall()
                
                # Get OBD data
                cursor.execute("SELECT * FROM obd_data WHERE session_id = ?", (session_id,))
                obd_data = cursor.fetchall()
                
                # Get behavior events
                cursor.execute("SELECT * FROM behavior_events WHERE session_id = ?", (session_id,))
                behavior_events = cursor.fetchall()
                
                return {
                    "session": dict(session),
                    "sensor_data": [dict(row) for row in sensor_data],
                    "obd_data": [dict(row) for row in obd_data],
                    "behavior_events": [dict(row) for row in behavior_events]
                }
        except Exception as e:
            logger.error(f"Failed to get session data: {str(e)}")
            raise

    def store_log(self, level: str, message: str, source: str = None):
        """Store a log entry in the database"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "INSERT INTO logs (timestamp, level, message, source) VALUES (?, ?, ?, ?)",
                    (datetime.now(), level, message, source)
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to store log: {str(e)}")
            # Do not raise to avoid recursion

    def get_logs(self, limit: int = 100, level: str = None) -> list:
        """Fetch recent logs from the database, optionally filtered by level"""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                if level:
                    cursor.execute(
                        "SELECT * FROM logs WHERE level = ? ORDER BY timestamp DESC LIMIT ?",
                        (level, limit)
                    )
                else:
                    cursor.execute(
                        "SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?",
                        (limit,)
                    )
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to fetch logs: {str(e)}")
            return []

    def get_last_open_session(self) -> Optional[RidingSession]:
        """Return the most recent open (not ended) session, or None if all are ended."""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT * FROM riding_sessions WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1"
                )
                row = cursor.fetchone()
                if row:
                    return RidingSession(
                        id=row['id'],
                        start_time=datetime.fromisoformat(row['start_time']),
                        end_time=None,
                        total_aggressive_events=row['total_aggressive_events'],
                        average_speed=row['average_speed'],
                        max_speed=row['max_speed']
                    )
                return None
        except Exception as e:
            logger.error(f"Failed to get last open session: {str(e)}")
            return None

    def get_all_behavior_events(self, limit: int = 200) -> list:
        """Fetch all behavior events, most recent first, with optional limit."""
        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT * FROM behavior_events ORDER BY timestamp DESC LIMIT ?",
                    (limit,)
                )
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Failed to fetch all behavior events: {str(e)}")
            return [] 