import numpy as np
import tensorflow as tf
from collections import deque
import threading
import time

class BehaviorPredictor:
    def __init__(self, model_path=None, sequence_length=50):
        self.sequence_length = sequence_length
        self.data_buffer = deque(maxlen=sequence_length)
        self.lock = threading.Lock()
        self.latest_prediction = None
        self.behaviors = ['Normal', 'Aggressive Acceleration', 'Aggressive Deceleration', 'Aggressive Lane Change']
        
        # Initialize model
        if model_path:
            self.model = tf.keras.models.load_model(model_path)
        else:
            self.model = self._create_model()
            
        # Start prediction thread
        self.running = True
        self.prediction_thread = threading.Thread(target=self._prediction_loop)
        self.prediction_thread.daemon = True
        self.prediction_thread.start()

    def _create_model(self):
        # Create a simple LSTM model
        model = tf.keras.Sequential([
            tf.keras.layers.LSTM(64, input_shape=(self.sequence_length, 6)),
            tf.keras.layers.Dense(32, activation='relu'),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(len(self.behaviors), activation='softmax')
        ])
        model.compile(optimizer='adam',
                     loss='categorical_crossentropy',
                     metrics=['accuracy'])
        return model

    def add_data_point(self, accel_data, gyro_data):
        # Combine accelerometer and gyroscope data
        data_point = [
            accel_data['x'], accel_data['y'], accel_data['z'],
            gyro_data['x'], gyro_data['y'], gyro_data['z']
        ]
        
        with self.lock:
            self.data_buffer.append(data_point)

    def _prediction_loop(self):
        while self.running:
            if len(self.data_buffer) >= self.sequence_length:
                with self.lock:
                    # Convert buffer to numpy array
                    data = np.array(list(self.data_buffer))
                    # Normalize data (simple scaling, you might want to use proper scaling in production)
                    data = (data - np.mean(data, axis=0)) / (np.std(data, axis=0) + 1e-7)
                    # Reshape for model input
                    data = np.expand_dims(data, axis=0)
                    
                    # Make prediction
                    prediction = self.model.predict(data, verbose=0)
                    self.latest_prediction = {
                        'behavior': self.behaviors[np.argmax(prediction[0])],
                        'confidence': float(np.max(prediction[0])),
                        'timestamp': time.time()
                    }
            
            time.sleep(0.1)  # Predict every 100ms

    def get_latest_prediction(self):
        return self.latest_prediction if self.latest_prediction else {
            'behavior': 'Insufficient Data',
            'confidence': 0.0,
            'timestamp': time.time()
        }

    def stop(self):
        self.running = False
        self.prediction_thread.join() 