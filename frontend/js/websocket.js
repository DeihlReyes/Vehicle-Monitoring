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
      normal: 0,
      aggressive_acceleration: 0,
      aggressive_braking: 0,
      aggressive_turning: 0,
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

      // Update counts based on the event type
      this.behaviorStats.total++;

      switch (behavior.event) {
        case "normal_driving":
          this.behaviorStats.normal++;
          break;
        case "aggressive_acceleration":
          this.behaviorStats.aggressive_acceleration++;
          break;
        case "aggressive_braking":
          this.behaviorStats.aggressive_braking++;
          break;
        case "aggressive_turning":
          this.behaviorStats.aggressive_turning++;
          break;
      }

      // Update UI
      this.updateBehaviorUI();

      // Update the behavior chart
      const totalAggressive =
        this.behaviorStats.aggressive_acceleration +
        this.behaviorStats.aggressive_braking +
        this.behaviorStats.aggressive_turning;

      // Calculate percentages
      const total = this.behaviorStats.normal + totalAggressive;
      const normalPercentage =
        total > 0 ? (this.behaviorStats.normal / total) * 100 : 100;
      const aggressivePercentage =
        total > 0 ? (totalAggressive / total) * 100 : 0;

      console.log(
        `Behavior distribution: Normal ${normalPercentage.toFixed(
          1
        )}%, Aggressive ${aggressivePercentage.toFixed(1)}%`
      );

      if (
        window.charts &&
        typeof window.charts.updateBehaviorChart === "function"
      ) {
        window.charts.updateBehaviorChart(
          normalPercentage,
          aggressivePercentage
        );
      } else {
        console.warn(
          "Charts module or updateBehaviorChart function not available"
        );
      }
    }
  }

  updateBehaviorUI() {
    // Update behavior counts
    const normalCountElement = document.getElementById("normal-count");
    const aggressiveCountElement = document.getElementById("aggressive-count");

    if (normalCountElement) {
      normalCountElement.textContent = this.behaviorStats.normal;
    }

    if (aggressiveCountElement) {
      const totalAggressive =
        this.behaviorStats.aggressive_acceleration +
        this.behaviorStats.aggressive_braking +
        this.behaviorStats.aggressive_turning;
      aggressiveCountElement.textContent = totalAggressive;
    }

    // Update recent events list
    const recentEventsElement = document.getElementById("recent-events");
    if (recentEventsElement) {
      recentEventsElement.innerHTML = "";

      if (this.behaviorStats.recent_events.length === 0) {
        const noEventsItem = document.createElement("li");
        noEventsItem.className = "list-group-item text-center text-muted";
        noEventsItem.textContent = "No events recorded";
        recentEventsElement.appendChild(noEventsItem);
      } else {
        this.behaviorStats.recent_events.forEach((event) => {
          const listItem = document.createElement("li");
          listItem.className = "list-group-item";

          let eventClass = "text-primary";
          let eventIcon = "🚗"; // Default icon

          switch (event.type) {
            case "aggressive_acceleration":
              eventClass = "text-danger";
              eventIcon = "🚀";
              break;
            case "aggressive_braking":
              eventClass = "text-warning";
              eventIcon = "🛑";
              break;
            case "aggressive_turning":
              eventClass = "text-info";
              eventIcon = "↩️";
              break;
            case "normal_driving":
              eventClass = "text-success";
              eventIcon = "✅";
              break;
          }

          listItem.innerHTML = `
            <span class="${eventClass}">
              ${eventIcon} ${this.formatBehaviorType(event.type)}
            </span>
            <span class="float-end text-muted small">${event.timestamp}</span>
          `;

          recentEventsElement.appendChild(listItem);
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
      if (obdData.speed !== undefined) {
        const speedElement = document.getElementById("vehicle-speed");
        if (speedElement) {
          speedElement.textContent = `${Math.round(obdData.speed)} km/h`;
        }
      }

      if (obdData.rpm !== undefined) {
        const rpmElement = document.getElementById("engine-rpm");
        if (rpmElement) {
          rpmElement.textContent = `${Math.round(obdData.rpm)} RPM`;
        }
      }

      if (obdData.temperature !== undefined) {
        const tempElement = document.getElementById("engine-temp");
        if (tempElement) {
          tempElement.textContent = `${Math.round(obdData.temperature)} °C`;
        }
      }

      if (obdData.fuel_level !== undefined) {
        const fuelElement = document.getElementById("fuel-level");
        if (fuelElement) {
          fuelElement.textContent = `${Math.round(obdData.fuel_level)}%`;
        }
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
