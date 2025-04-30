import numpy as np
import tensorflow as tf
from collections import deque
import threading
import time
import logging

logger = logging.getLogger(__name__)

class BehaviorPredictor:
    def __init__(self, model_path=None, sequence_length=25):
        self.sequence_length = sequence_length
        self.data_buffer = deque(maxlen=sequence_length)
        self.lock = threading.Lock()
        self.latest_prediction = None
        self.behaviors = ['aggressive_acceleration', 'normal_acceleration', 'aggressive_deceleration', 'normal_deceleration', 'aggressive_lane_change', 'normal_lane_change']
        self.model = None
        self.running = True
        self.last_prediction_time = 0
        self.prediction_interval = 0.05
        self.min_confidence_threshold = 0.6
        
        # Statistics for normalization
        self.running_mean = None
        self.running_std = None
        self.update_rate = 0.1
        
        # Require model_path and load model
        if not model_path:
            logger.error("BehaviorPredictor requires a model_path. No model will be loaded.")
            raise ValueError("BehaviorPredictor requires a model_path.")
        try:
            self.model = tf.keras.models.load_model(model_path)
            logger.info(f"Loaded behavior model from {model_path}")
            
            # Initialize running statistics
            self.running_mean = np.zeros(9)
            self.running_std = np.ones(9)
        except Exception as e:
            logger.error(f"Failed to load behavior model from {model_path}: {str(e)}")
            raise
            
        # Start prediction thread
        try:
            self.prediction_thread = threading.Thread(target=self._prediction_loop)
            self.prediction_thread.daemon = True
            self.prediction_thread.start()
            logger.info("Prediction thread started.")
        except Exception as e:
            logger.error(f"Failed to start prediction thread: {str(e)}")
            self.running = False

    def add_data_point(self, accel_data, gyro_data, speed):
        # Compose the 9-feature input vector
        abs_acc = accel_data.get('absolute')
        abs_gyro = gyro_data.get('absolute')
        data_point = [
            accel_data['x'], accel_data['y'], accel_data['z'],
            abs_acc,
            gyro_data['x'], gyro_data['y'], gyro_data['z'],
            abs_gyro,
            speed
        ]
        
        # Update running statistics
        if len(self.data_buffer) > 0:
            self.running_mean = (1 - self.update_rate) * self.running_mean + self.update_rate * np.array(data_point)
            self.running_std = (1 - self.update_rate) * self.running_std + self.update_rate * np.abs(np.array(data_point) - self.running_mean)
        
        with self.lock:
            self.data_buffer.append(data_point)
            logger.debug(f"Added data point to buffer: {data_point}. Buffer size: {len(self.data_buffer)}/{self.sequence_length}")

    def _prediction_loop(self):
        while self.running:
            try:
                current_time = time.time()
                if (current_time - self.last_prediction_time) < self.prediction_interval:
                    time.sleep(0.001)
                    continue
                    
                if self.model is None:
                    logger.warning("Behavior model is not loaded; skipping prediction.")
                    time.sleep(0.1)
                    continue
                    
                if len(self.data_buffer) >= self.sequence_length:
                    with self.lock:
                        data = np.array(list(self.data_buffer))
                    
                    # Use running statistics for normalization
                    data = (data - self.running_mean) / (self.running_std + 1e-7)
                    data = np.expand_dims(data, axis=0)
                    
                    try:
                        prediction = self.model.predict(data, verbose=0)
                        confidence = float(np.max(prediction[0]))
                        
                        # Only update prediction if confidence exceeds threshold
                        if confidence >= self.min_confidence_threshold:
                            behavior = self.behaviors[np.argmax(prediction[0])]
                            self.latest_prediction = {
                                'behavior': behavior,
                                'confidence': confidence,
                                'timestamp': current_time
                            }
                            logger.debug(f"New prediction: {behavior} (confidence: {confidence:.2f})")
                    except Exception as e:
                        logger.error(f"Behavior model prediction error: {str(e)}")
                        self.latest_prediction = {
                            'behavior': 'Prediction Error',
                            'confidence': 0.0,
                            'timestamp': current_time
                        }
                
                self.last_prediction_time = current_time
                
            except Exception as e:
                logger.error(f"Error in prediction loop: {str(e)}")
                time.sleep(0.1)

    def get_latest_prediction(self):
        if self.latest_prediction:
            # Check if prediction is stale (older than 1 second)
            if time.time() - self.latest_prediction['timestamp'] > 1.0:
                logger.warning("Using stale prediction")
            return self.latest_prediction
        else:
            logger.warning("No prediction available yet, returning default.")
            return {
                'behavior': 'Insufficient Data',
                'confidence': 0.0,
                'timestamp': time.time()
            }

    def stop(self):
        self.running = False
        try:
            self.prediction_thread.join()
            logger.info("Prediction thread stopped.")
        except Exception as e:
            logger.error(f"Error stopping prediction thread: {str(e)}") 