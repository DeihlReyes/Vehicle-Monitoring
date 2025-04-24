// Initialize Socket.IO connection
const socket = io();

// Connection status handling
socket.on("connect", () => {
  console.log("Connected to server");
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
});

// Handle sensor data
socket.on("mpu_data", (data) => {
  // Update accelerometer chart
  window.charts.updateAccelerometerChart({
    x: data.accel_x,
    y: data.accel_y,
    z: data.accel_z,
  });

  // Update gyroscope chart
  window.charts.updateGyroscopeChart({
    roll: data.gyro_x,
    pitch: data.gyro_y,
    yaw: data.gyro_z,
  });
});

// Handle behavior predictions
socket.on("behavior_prediction", (data) => {
  // Update behavior status
  window.app.updateBehaviorStatus(data.behavior);

  // Add event to list
  window.app.addEvent({
    type: data.behavior,
    confidence: data.confidence,
  });

  // Update behavior counts
  window.app.updateBehaviorCounts({
    aggressive: data.counts.aggressive,
    normal: data.counts.normal,
  });

  // Update behavior distribution chart
  window.charts.updateBehaviorChart({
    aggressive: data.counts.aggressive,
    normal: data.counts.normal,
  });
});

// Handle OBD data
socket.on("obd_data", (data) => {
  window.app.updateOBDMetrics({
    rpm: data.rpm,
    speed: data.speed,
    throttle: data.throttle_pos,
    coolant: data.coolant_temp,
    intake: data.intake_temp,
    battery: data.battery_voltage,
    engineLoad: data.engine_load,
  });
});

// Error handling
socket.on("error", (error) => {
  console.error("Socket error:", error);
});

// Reconnection handling
socket.on("reconnect_attempt", () => {
  console.log("Attempting to reconnect...");
});

socket.on("reconnect", () => {
  console.log("Reconnected to server");
});

// Export socket for use in other modules
window.socket = socket;
