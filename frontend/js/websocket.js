// WebSocket connection handler
class WebSocketHandler {
  constructor(url) {
    console.log(`Initializing WebSocketHandler with URL: ${url}`);
    this.url = url;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.dataCallbacks = [];
    this.statusCallbacks = [];

    // System status tracking
    this.systemStatus = {
      websocket_connected: false,
      mpu_sensor_ok: true,
      obd_connection_ok: true,
      error_count: 0,
      hardware_errors: 0,
      data_errors: 0,
      connection_errors: 0,
      last_error: "",
    };

    // Behavior tracking
    this.behaviorStats = {
      aggressive_acceleration: 0,
      normal_acceleration: 0,
      aggressive_deceleration: 0,
      normal_deceleration: 0,
      aggressive_lane_change: 0,
      normal_lane_change: 0,
      total: 0,
      recent_events: [],
    };

    // Connect immediately
    this.connect();

    // Set up auto-reconnect
    setInterval(() => this.checkConnection(), 5000);
  }

  connect() {
    try {
      console.log(`Connecting to WebSocket at ${this.url}...`);
      this.socket = new WebSocket(this.url);

      this.socket.onopen = this.onOpen.bind(this);
      this.socket.onclose = this.onClose.bind(this);
      this.socket.onerror = this.onError.bind(this);
      this.socket.onmessage = this.onMessage.bind(this);
    } catch (error) {
      console.error("Error connecting to WebSocket:", error);
      this.logError("connection", `Failed to connect: ${error.message}`);
      this.systemStatus.websocket_connected = false;
      this.updateSystemStatus();
    }
  }

  onOpen(event) {
    console.log("WebSocket connection established");
    this.systemStatus.websocket_connected = true;
    this.reconnectAttempts = 0;
    this.updateSystemStatus();
    this.notifyStatusCallbacks({ connected: true });
  }

  onClose(event) {
    console.log(`WebSocket connection closed (${event.code}: ${event.reason})`);
    this.systemStatus.websocket_connected = false;
    this.updateSystemStatus();
    this.notifyStatusCallbacks({ connected: false });

    // Attempt reconnection if not closed normally
    if (
      event.code !== 1000 &&
      this.reconnectAttempts < this.maxReconnectAttempts
    ) {
      this.scheduleReconnect();
    }
  }

  onError(error) {
    console.error("WebSocket error:", error);
    this.logError("connection", "WebSocket connection error");
    this.systemStatus.websocket_connected = false;
    this.updateSystemStatus();
  }

  onMessage(event) {
    try {
      // Limit logging for performance
      if (Math.random() < 0.1) {
        // Log approximately 10% of messages
        const shortData =
          event.data.length > 100
            ? event.data.substring(0, 100) + "..."
            : event.data;
        console.log(`Received data: ${shortData}`);
      }

      const data = JSON.parse(event.data);
      this.processData(data);
      this.notifyDataCallbacks(data);
    } catch (error) {
      console.error("Error processing message:", error);
      this.logError("data", `Failed to process message: ${error.message}`);
    }
  }

  processData(data) {
    try {
      // Update sensor data for charts
      if (data.sensor_data) {
        if (
          window.charts &&
          typeof window.charts.updateAccelerometerChart === "function"
        ) {
          window.charts.updateAccelerometerChart(
            data.sensor_data.accelerometer.x,
            data.sensor_data.accelerometer.y,
            data.sensor_data.accelerometer.z
          );
        } else {
          console.warn(
            "Charts module or updateAccelerometerChart function not available"
          );
        }

        if (
          window.charts &&
          typeof window.charts.updateGyroscopeChart === "function"
        ) {
          window.charts.updateGyroscopeChart(
            data.sensor_data.gyroscope.x,
            data.sensor_data.gyroscope.y,
            data.sensor_data.gyroscope.z
          );
        } else {
          console.warn(
            "Charts module or updateGyroscopeChart function not available"
          );
        }
      }

      // Update behavior data
      if (data.behavior) {
        this.processBehaviorData(data.behavior);
      }

      // Update OBD metrics if available
      if (data.obd_data) {
        this.updateOBDMetrics(data.obd_data);
      }

      // Update system health
      if (data.system_health) {
        this.updateSystemHealth(data.system_health);
      }
    } catch (error) {
      console.error("Error processing data:", error);
      this.logError("data", `Error processing data: ${error.message}`);
    }
  }

  processBehaviorData(behavior) {
    console.log("Processing behavior data:", behavior);

    if (behavior.event) {
      // Add to recent events with timestamp
      const timestamp = new Date().toLocaleTimeString();
      const newEvent = {
        type: behavior.event,
        timestamp: timestamp,
      };

      // Add to the beginning of the array
      this.behaviorStats.recent_events.unshift(newEvent);

      // Keep only the 10 most recent events
      if (this.behaviorStats.recent_events.length > 10) {
        this.behaviorStats.recent_events.pop();
      }

      // Update counts based on the event type (skip for rider_stopped)
      if (behavior.event !== "rider_stopped") {
        this.behaviorStats.total++;
        if (this.behaviorStats[behavior.event] !== undefined) {
          this.behaviorStats[behavior.event]++;
        }
      }

      // Update the current behavior display in the OBD tab
      const behaviorStatus = document.getElementById("behavior-status");
      if (behaviorStatus) {
        let statusClass = behavior.event.startsWith("aggressive")
          ? "aggressive"
          : "normal";
        behaviorStatus.className = `behavior-indicator ${statusClass}`;
        behaviorStatus.textContent = this.formatBehaviorType(behavior.event);
      }

      // Update UI
      this.updateBehaviorUI();

      // Calculate percentages for behavior chart (excluding rider_stopped)
      const total = this.behaviorStats.total || 1; // Avoid division by zero
      const percentages = {
        aggressive_acceleration:
          (this.behaviorStats.aggressive_acceleration / total) * 100,
        normal_acceleration:
          (this.behaviorStats.normal_acceleration / total) * 100,
        aggressive_deceleration:
          (this.behaviorStats.aggressive_deceleration / total) * 100,
        normal_deceleration:
          (this.behaviorStats.normal_deceleration / total) * 100,
        aggressive_lane_change:
          (this.behaviorStats.aggressive_lane_change / total) * 100,
        normal_lane_change:
          (this.behaviorStats.normal_lane_change / total) * 100,
      };

      console.log("Behavior distribution:", percentages);

      if (
        window.charts &&
        typeof window.charts.updateBehaviorChart === "function"
      ) {
        window.charts.updateBehaviorChart(percentages);
      } else {
        console.warn(
          "Charts module or updateBehaviorChart function not available"
        );
      }
    }
  }

  updateBehaviorUI() {
    // Update behavior counts
    const behaviorTypes = [
      "aggressive_acceleration",
      "normal_acceleration",
      "aggressive_deceleration",
      "normal_deceleration",
      "aggressive_lane_change",
      "normal_lane_change",
    ];
    behaviorTypes.forEach((type) => {
      const el = document.getElementById(`${type}-count`);
      if (el) {
        el.textContent = this.behaviorStats[type];
      }
    });

    // Update recent events list
    const eventsListElement = document.getElementById("events-list");
    if (eventsListElement) {
      eventsListElement.innerHTML = "";

      if (this.behaviorStats.recent_events.length === 0) {
        const noEventsItem = document.createElement("div");
        noEventsItem.className = "event-item text-center text-muted";
        noEventsItem.textContent = "No events recorded";
        eventsListElement.appendChild(noEventsItem);
      } else {
        this.behaviorStats.recent_events.forEach((event) => {
          const eventItem = document.createElement("div");
          eventItem.className = "event-item";

          let eventClass = "normal";
          let eventIcon = "🚗"; // Default icon

          switch (event.type) {
            case "aggressive_acceleration":
              eventClass = "aggressive";
              eventIcon = "🚀";
              break;
            case "normal_acceleration":
              eventClass = "normal";
              eventIcon = "✅";
              break;
            case "aggressive_deceleration":
              eventClass = "aggressive";
              eventIcon = "🛑";
              break;
            case "normal_deceleration":
              eventClass = "normal";
              eventIcon = "🟢";
              break;
            case "aggressive_lane_change":
              eventClass = "aggressive";
              eventIcon = "↔️";
              break;
            case "normal_lane_change":
              eventClass = "normal";
              eventIcon = "➡️";
              break;
          }

          eventItem.innerHTML = `
            <span class="event-badge ${eventClass}">
              ${eventIcon} ${this.formatBehaviorType(event.type)}
            </span>
            <span class="event-time">${event.timestamp}</span>
          `;

          eventsListElement.appendChild(eventItem);
        });
      }
    }
  }

  formatBehaviorType(type) {
    // Convert snake_case to Title Case with spaces
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  updateOBDMetrics(obdData) {
    try {
      console.log("Updating OBD metrics with:", obdData);

      // Update rpm-value
      const rpmElement = document.getElementById("rpm-value");
      if (rpmElement && obdData.rpm !== undefined) {
        rpmElement.textContent = `${Math.round(obdData.rpm)}`;
      }

      // Update speed-value
      const speedElement = document.getElementById("speed-value");
      if (speedElement && obdData.speed !== undefined) {
        speedElement.textContent = `${Math.round(obdData.speed)} km/h`;
      }

      // Update throttle-value
      const throttleElement = document.getElementById("throttle-value");
      if (throttleElement && obdData.throttle !== undefined) {
        throttleElement.textContent = `${Math.round(obdData.throttle)}%`;
      }

      // Update coolant-temp
      const coolantElement = document.getElementById("coolant-temp");
      if (coolantElement && obdData.coolant !== undefined) {
        coolantElement.textContent = `${Math.round(obdData.coolant)}°C`;
      }

      // Update intake-temp
      const intakeElement = document.getElementById("intake-temp");
      if (intakeElement && obdData.intake !== undefined) {
        intakeElement.textContent = `${Math.round(obdData.intake)} kPa`;
      }

      // Update battery-voltage
      const batteryElement = document.getElementById("battery-voltage");
      if (batteryElement && obdData.battery !== undefined) {
        batteryElement.textContent = `${obdData.battery.toFixed(1)}V`;
      }

      // Update engine-load
      const engineLoadElement = document.getElementById("engine-load");
      if (engineLoadElement && obdData.engineLoad !== undefined) {
        engineLoadElement.textContent = `${Math.round(obdData.engineLoad)}%`;
      }
    } catch (error) {
      console.error("Error updating OBD metrics:", error);
    }
  }

  updateSystemHealth(healthData) {
    if (healthData.mpu_sensor_ok !== undefined) {
      this.systemStatus.mpu_sensor_ok = healthData.mpu_sensor_ok;
    }

    if (healthData.obd_connection_ok !== undefined) {
      this.systemStatus.obd_connection_ok = healthData.obd_connection_ok;
    }

    if (healthData.error_count !== undefined) {
      this.systemStatus.error_count = healthData.error_count;
    }

    if (healthData.hardware_errors !== undefined) {
      this.systemStatus.hardware_errors = healthData.hardware_errors;
    }

    if (healthData.data_errors !== undefined) {
      this.systemStatus.data_errors = healthData.data_errors;
    }

    if (healthData.connection_errors !== undefined) {
      this.systemStatus.connection_errors = healthData.connection_errors;
    }

    if (healthData.last_error) {
      this.systemStatus.last_error = healthData.last_error;
    }

    this.updateSystemStatus();
  }

  updateSystemStatus() {
    // Update the system status in the UI
    const statusElement = document.getElementById("system-status");
    if (!statusElement) return;

    // Clear existing content
    statusElement.innerHTML = "";

    // Create status items
    const createStatusItem = (label, status, description) => {
      const statusClass = status ? "bg-success" : "bg-danger";
      const statusText = status ? "OK" : "Error";

      return `
        <div class="status-item">
          <div class="status-label">${label}</div>
          <div class="status-value">
            <span class="badge ${statusClass}">${statusText}</span>
            ${
              description
                ? `<span class="status-description">${description}</span>`
                : ""
            }
          </div>
        </div>
      `;
    };

    // WebSocket connection
    statusElement.innerHTML += createStatusItem(
      "WebSocket",
      this.systemStatus.websocket_connected,
      this.systemStatus.websocket_connected ? "Connected" : "Disconnected"
    );

    // MPU6050 sensor
    statusElement.innerHTML += createStatusItem(
      "MPU6050 Sensor",
      this.systemStatus.mpu_sensor_ok,
      this.systemStatus.mpu_sensor_ok ? "Operational" : "Not responding"
    );

    // OBD connection
    statusElement.innerHTML += createStatusItem(
      "OBD Connection",
      this.systemStatus.obd_connection_ok,
      this.systemStatus.obd_connection_ok ? "Connected" : "Disconnected"
    );

    // Error counters
    statusElement.innerHTML += `
      <div class="status-item">
        <div class="status-label">Error Counts</div>
        <div class="status-value">
          <div class="error-counts">
            <span class="badge bg-secondary">Total: ${this.systemStatus.error_count}</span>
            <span class="badge bg-warning text-dark">HW: ${this.systemStatus.hardware_errors}</span>
            <span class="badge bg-info text-dark">Data: ${this.systemStatus.data_errors}</span>
            <span class="badge bg-danger">Conn: ${this.systemStatus.connection_errors}</span>
          </div>
        </div>
      </div>
    `;

    // Last error message
    if (this.systemStatus.last_error) {
      statusElement.innerHTML += `
        <div class="status-item">
          <div class="status-label">Last Error</div>
          <div class="status-value error-message">
            ${this.systemStatus.last_error}
          </div>
        </div>
      `;
    }

    // Add connection control buttons
    statusElement.innerHTML += `
      <div class="status-controls mt-2">
        <button id="reconnect-btn" class="btn btn-sm btn-primary me-2">Reconnect</button>
        <button id="reset-errors-btn" class="btn btn-sm btn-secondary">Reset Errors</button>
      </div>
    `;

    // Set up reconnect button functionality
    const reconnectBtn = document.getElementById("reconnect-btn");
    if (reconnectBtn) {
      reconnectBtn.addEventListener("click", () => {
        console.log("Manual reconnection requested");
        this.reset();
      });
    }

    // Set up reset errors button functionality
    const resetErrorsBtn = document.getElementById("reset-errors-btn");
    if (resetErrorsBtn) {
      resetErrorsBtn.addEventListener("click", () => {
        console.log("Resetting error counts");
        this.systemStatus.error_count = 0;
        this.systemStatus.hardware_errors = 0;
        this.systemStatus.data_errors = 0;
        this.systemStatus.connection_errors = 0;
        this.systemStatus.last_error = "";
        this.updateSystemStatus();
      });
    }
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    console.log(
      `Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`
    );

    setTimeout(() => {
      if (!this.systemStatus.websocket_connected) {
        console.log(
          `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        );
        this.connect();
      }
    }, delay);
  }

  checkConnection() {
    if (this.socket && this.socket.readyState !== WebSocket.OPEN) {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        console.log("Connection check failed, reconnecting...");
        this.connect();
      }
    }
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(data));
      } catch (error) {
        console.error("Error sending data:", error);
        this.logError("connection", `Failed to send data: ${error.message}`);
      }
    } else {
      console.error("WebSocket not connected, cannot send data");
      this.logError("connection", "Cannot send data: WebSocket not connected");
    }
  }

  registerDataCallback(callback) {
    if (typeof callback === "function") {
      this.dataCallbacks.push(callback);
      console.log(
        `Registered data callback, total callbacks: ${this.dataCallbacks.length}`
      );
      return true;
    }
    return false;
  }

  registerStatusCallback(callback) {
    if (typeof callback === "function") {
      this.statusCallbacks.push(callback);
      console.log(
        `Registered status callback, total callbacks: ${this.statusCallbacks.length}`
      );
      return true;
    }
    return false;
  }

  notifyDataCallbacks(data) {
    this.dataCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("Error in data callback:", error);
      }
    });
  }

  notifyStatusCallbacks(status) {
    this.statusCallbacks.forEach((callback) => {
      try {
        callback(status);
      } catch (error) {
        console.error("Error in status callback:", error);
      }
    });
  }

  reset() {
    console.log("Resetting WebSocket connection and error counts");

    // Reset error counts
    this.systemStatus.error_count = 0;
    this.systemStatus.hardware_errors = 0;
    this.systemStatus.data_errors = 0;
    this.systemStatus.connection_errors = 0;
    this.systemStatus.last_error = "";

    // Update UI
    this.updateSystemStatus();

    // Force reconnection
    if (this.socket) {
      this.socket.close();
    }

    this.reconnectAttempts = 0;
    setTimeout(() => this.connect(), 1000);
  }

  logError(type, message) {
    console.error(`${type.toUpperCase()} ERROR: ${message}`);

    // Increment error counters
    this.systemStatus.error_count++;

    switch (type.toLowerCase()) {
      case "hardware":
        this.systemStatus.hardware_errors++;
        break;
      case "data":
        this.systemStatus.data_errors++;
        break;
      case "connection":
        this.systemStatus.connection_errors++;
        break;
    }

    // Update last error message
    this.systemStatus.last_error = message;

    // Update UI
    this.updateSystemStatus();
  }
}

// Initialize WebSocket connection when the page loads
let websocketHandler = null;

function setupWebSocket() {
  console.log("Setting up WebSocket connection");

  // Determine the WebSocket URL
  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsHost = window.location.hostname || "localhost";
  const wsPort = 8000; // Backend WebSocket port
  const wsUrl = `${wsProtocol}//${wsHost}:${wsPort}/ws`;

  console.log(`Connecting to WebSocket at ${wsUrl}`);

  // Create WebSocket handler
  websocketHandler = new WebSocketHandler(wsUrl);

  // Set up reconnect button functionality
  const reconnectBtn = document.getElementById("reconnect-btn");
  if (reconnectBtn) {
    reconnectBtn.addEventListener("click", () => {
      console.log("Manual reconnection requested");
      websocketHandler.reset();
    });
  }

  // Set up reset errors button functionality
  const resetErrorsBtn = document.getElementById("reset-errors-btn");
  if (resetErrorsBtn) {
    resetErrorsBtn.addEventListener("click", () => {
      console.log("Resetting error counts");
      if (websocketHandler) {
        websocketHandler.systemStatus.error_count = 0;
        websocketHandler.systemStatus.hardware_errors = 0;
        websocketHandler.systemStatus.data_errors = 0;
        websocketHandler.systemStatus.connection_errors = 0;
        websocketHandler.systemStatus.last_error = "";
        websocketHandler.updateSystemStatus();
      }
    });
  }
}

// Initialize when the DOM is loaded
document.addEventListener("DOMContentLoaded", setupWebSocket);

// Export the websocket handler for use in other modules
window.websocketHandler = websocketHandler;
