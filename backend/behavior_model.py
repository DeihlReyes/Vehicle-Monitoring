import numpy as np
import tensorflow as tf
from collections import deque
import threading
import time
import logging

logger = logging.getLogger(__name__)

class BehaviorPredictor:
    def __init__(self, model_path=None, sequence_length=50):
        self.sequence_length = sequence_length
        self.data_buffer = deque(maxlen=sequence_length)
        self.lock = threading.Lock()
        self.latest_prediction = None
        self.behaviors = ['normal_driving', 'aggressive_acceleration', 'aggressive_braking', 'aggressive_turning']
        self.model = None
        # Require model_path and load model
        if not model_path:
            logger.error("BehaviorPredictor requires a model_path. No model will be loaded.")
            raise ValueError("BehaviorPredictor requires a model_path.")
        try:
            self.model = tf.keras.models.load_model(model_path)
            logger.info(f"Loaded behavior model from {model_path}")
        except Exception as e:
            logger.error(f"Failed to load behavior model from {model_path}: {str(e)}")
            raise
        # Start prediction thread
        self.running = True
        try:
            self.prediction_thread = threading.Thread(target=self._prediction_loop)
            self.prediction_thread.daemon = True
            self.prediction_thread.start()
            logger.info("Prediction thread started.")
        except Exception as e:
            logger.error(f"Failed to start prediction thread: {str(e)}")
            self.running = False

    def add_data_point(self, accel_data, gyro_data):
        data_point = [
            accel_data['x'], accel_data['y'], accel_data['z'],
            gyro_data['x'], gyro_data['y'], gyro_data['z']
        ]
        with self.lock:
            self.data_buffer.append(data_point)
            logger.debug(f"Added data point to buffer. Buffer size: {len(self.data_buffer)}/{self.sequence_length}")

    def _prediction_loop(self):
        while self.running:
            try:
                if self.model is None:
                    logger.warning("Behavior model is not loaded; skipping prediction.")
                    time.sleep(1)
                    continue
                if len(self.data_buffer) >= self.sequence_length:
                    with self.lock:
                        data = np.array(list(self.data_buffer))
                        mean = np.mean(data, axis=0)
                        std = np.std(data, axis=0)
                        data = (data - mean) / (std + 1e-7)
                        data = np.expand_dims(data, axis=0)
                        try:
                            logger.info("Making behavior prediction...")
                            prediction = self.model.predict(data, verbose=0)
                            behavior = self.behaviors[np.argmax(prediction[0])]
                            confidence = float(np.max(prediction[0]))
                            self.latest_prediction = {
                                'behavior': behavior,
                                'confidence': confidence,
                                'timestamp': time.time()
                            }
                            logger.info(f"Prediction made: {behavior} (confidence: {confidence:.2f})")
                        except Exception as e:
                            logger.error(f"Behavior model prediction error: {str(e)}")
                            self.latest_prediction = {
                                'behavior': 'Prediction Error',
                                'confidence': 0.0,
                                'timestamp': time.time()
                            }
                else:
                    logger.debug(f"Not enough data for prediction: {len(self.data_buffer)}/{self.sequence_length}")
                time.sleep(0.1)
            except Exception as e:
                logger.error(f"Error in prediction loop: {str(e)}")
                time.sleep(1)

    def get_latest_prediction(self):
        if self.latest_prediction:
            logger.debug(f"Returning latest prediction: {self.latest_prediction}")
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