// WebSocket connection handler
class WebSocketHandler {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second delay
    this.behaviorStats = {
      total: 0,
      aggressive_acceleration: 0,
      normal_acceleration: 0,
      aggressive_deceleration: 0,
      normal_deceleration: 0,
      aggressive_lane_change: 0,
      normal_lane_change: 0,
      recent_events: [],
    };
    // Add performance optimization variables
    this.lastProcessedData = null;
    this.processingQueue = [];
    this.isProcessing = false;
    this.throttleTime = 50; // Throttle UI updates to 20fps (50ms)
    this.lastUIUpdate = 0;
    this.animationFrameId = null;

    this.initializeWebSocket();
    this.setupPerformanceMonitoring();
  }

  setupPerformanceMonitoring() {
    // Measure and report performance metrics
    this.performanceMetrics = {
      messageCount: 0,
      processingTimes: [],
      avgProcessingTime: 0,
      maxProcessingTime: 0,
      droppedFrames: 0,
    };

    // Start performance monitoring loop
    setInterval(() => {
      if (this.performanceMetrics.processingTimes.length > 0) {
        const sum = this.performanceMetrics.processingTimes.reduce(
          (a, b) => a + b,
          0
        );
        this.performanceMetrics.avgProcessingTime =
          sum / this.performanceMetrics.processingTimes.length;
        console.log("WebSocket Performance:", {
          messagesPerSecond: this.performanceMetrics.messageCount,
          avgProcessingTime:
            this.performanceMetrics.avgProcessingTime.toFixed(2) + "ms",
          maxProcessingTime:
            this.performanceMetrics.maxProcessingTime.toFixed(2) + "ms",
          droppedFrames: this.performanceMetrics.droppedFrames,
        });

        // Reset metrics
        this.performanceMetrics.messageCount = 0;
        this.performanceMetrics.processingTimes = [];
        this.performanceMetrics.maxProcessingTime = 0;
        this.performanceMetrics.droppedFrames = 0;
      }
    }, 5000);
  }

  initializeWebSocket() {
    try {
      // Get the base URL from the current window location
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const hostname = window.location.hostname || "localhost";
      const wsUrl = `${protocol}//${hostname}:8000/ws`;

      console.log("Initializing WebSocket connection to:", wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("WebSocket connection established successfully");
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.onConnectionChange(true);
      };

      this.ws.onclose = (event) => {
        console.log(
          "WebSocket connection closed. Code:",
          event.code,
          "Reason:",
          event.reason
        );
        this.onConnectionChange(false);
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        console.log("WebSocket readyState:", this.ws.readyState);
        this.onConnectionChange(false);
      };

      this.ws.onmessage = (event) => {
        try {
          // Optimization: Queue messages for processing to avoid UI blocking
          const data = JSON.parse(event.data);
          this.queueDataForProcessing(data);
          this.performanceMetrics.messageCount++;
        } catch (error) {
          console.error("Error processing WebSocket message:", error);
          console.log("Raw message data:", event.data);
        }
      };
    } catch (error) {
      console.error("Error initializing WebSocket:", error);
      this.attemptReconnect();
    }
  }

  queueDataForProcessing(data) {
    // Add data to processing queue
    this.processingQueue.push(data);

    // If we're not already processing, start processing
    if (!this.isProcessing) {
      this.processQueuedData();
    }
  }

  processQueuedData() {
    // Mark as processing
    this.isProcessing = true;

    // Cancel any existing animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Process data using requestAnimationFrame for better performance
    this.animationFrameId = requestAnimationFrame(() => {
      const startTime = performance.now();

      // Only process the most recent data if we have a backlog
      if (this.processingQueue.length > 3) {
        // Keep the first item (oldest) and the last item (newest)
        const oldestData = this.processingQueue[0];
        const newestData =
          this.processingQueue[this.processingQueue.length - 1];
        this.processingQueue = [oldestData, newestData];
        this.performanceMetrics.droppedFrames +=
          this.processingQueue.length - 2;
      }

      // Process the next item in the queue
      if (this.processingQueue.length > 0) {
        const data = this.processingQueue.shift();

        // Only update UI if enough time has passed since last update
        const now = performance.now();
        if (now - this.lastUIUpdate >= this.throttleTime) {
          this.processWebSocketData(data);
          this.lastUIUpdate = now;
        }
      }

      // Record processing time
      const processingTime = performance.now() - startTime;
      this.performanceMetrics.processingTimes.push(processingTime);
      this.performanceMetrics.maxProcessingTime = Math.max(
        this.performanceMetrics.maxProcessingTime,
        processingTime
      );

      // Continue processing if there are more items or stop if done
      if (this.processingQueue.length > 0) {
        this.animationFrameId = requestAnimationFrame(() =>
          this.processQueuedData()
        );
      } else {
        this.isProcessing = false;
      }
    });
  }

  processWebSocketData(data) {
    try {
      // Optimization: Skip processing if data hasn't changed significantly
      if (
        this.lastProcessedData &&
        this.isDataSimilar(data, this.lastProcessedData)
      ) {
        return;
      }

      // Update sensor data displays
      if (data.sensor_data) {
        const accel = data.sensor_data.accelerometer;
        const gyro = data.sensor_data.gyroscope;

        if (
          window.charts &&
          typeof window.charts.updateAccelerometerDisplay === "function"
        ) {
          window.charts.updateAccelerometerDisplay(accel.x, accel.y, accel.z);
        }

        if (
          window.charts &&
          typeof window.charts.updateGyroscopeDisplay === "function"
        ) {
          window.charts.updateGyroscopeDisplay(gyro.x, gyro.y, gyro.z);
        }
      }

      // Update behavior data - only if it has changed
      if (
        data.behavior &&
        (!this.lastProcessedData ||
          data.behavior.event !== this.lastProcessedData.behavior.event)
      ) {
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

      // Store last processed data for comparison
      this.lastProcessedData = data;
    } catch (error) {
      console.error("Error processing data:", error);
      this.logError("data", `Error processing data: ${error.message}`);
    }
  }

  isDataSimilar(newData, oldData) {
    // Check if sensor data is similar enough to skip update
    if (newData.sensor_data && oldData.sensor_data) {
      const newAccel = newData.sensor_data.accelerometer;
      const oldAccel = oldData.sensor_data.accelerometer;
      const newGyro = newData.sensor_data.gyroscope;
      const oldGyro = oldData.sensor_data.gyroscope;

      // Only update if values changed by more than threshold
      const threshold = 0.05;
      if (
        Math.abs(newAccel.x - oldAccel.x) > threshold ||
        Math.abs(newAccel.y - oldAccel.y) > threshold ||
        Math.abs(newAccel.z - oldAccel.z) > threshold ||
        Math.abs(newGyro.x - oldGyro.x) > threshold ||
        Math.abs(newGyro.y - oldGyro.y) > threshold ||
        Math.abs(newGyro.z - oldGyro.z) > threshold
      ) {
        return false;
      }
    }

    // Check if OBD data is similar
    if (newData.obd_data && oldData.obd_data) {
      // Update if speed or RPM changed significantly
      if (
        Math.abs(
          (newData.obd_data.speed || 0) - (oldData.obd_data.speed || 0)
        ) > 1 ||
        Math.abs((newData.obd_data.rpm || 0) - (oldData.obd_data.rpm || 0)) > 50
      ) {
        return false;
      }
    }

    // Check if behavior changed
    if (newData.behavior && oldData.behavior) {
      if (newData.behavior.event !== oldData.behavior.event) {
        return false;
      }
    }

    // Data is similar enough to skip update
    return true;
  }

  // System status tracking
  systemStatus = {
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
  behaviorStats = {
    aggressive_acceleration: 0,
    normal_acceleration: 0,
    aggressive_deceleration: 0,
    normal_deceleration: 0,
    aggressive_lane_change: 0,
    normal_lane_change: 0,
    total: 0,
    recent_events: [],
  };

  onConnectionChange(connected) {
    this.systemStatus.websocket_connected = connected;
    this.updateSystemStatus();
  }

  attemptReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;
    console.log(
      `Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`
    );

    setTimeout(() => {
      if (!this.systemStatus.websocket_connected) {
        console.log(
          `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        );
        this.initializeWebSocket();
      }
    }, delay);
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

      // Update battery health status
      const voltage = obdData.battery;
      const healthMsg = document.getElementById("battery-health-message");
      const batteryCard = document.getElementById("battery-card");
      const flipBack = batteryCard.querySelector(".flip-card-back");
      const flipFront = batteryCard.querySelector(".flip-card-front");

      if (healthMsg) {
        let msg = "Normal";
        let cls = "normal";

        // Parse voltage as float and ensure it's a valid number
        const voltageValue = parseFloat(voltage);

        if (
          typeof voltageValue !== "number" ||
          isNaN(voltageValue) ||
          voltageValue === 0
        ) {
          msg = "No battery data available";
          cls = "danger";
        } else if (voltageValue < 12.0) {
          msg = "Weak battery (< 12.0V)";
          cls = "danger";
        } else if (voltageValue > 14.5) {
          msg = "Overcharging (> 14.5V)";
          cls = "warning";
        } else {
          msg = "Normal (12.0V - 14.5V)";
          cls = "normal";
        }

        // Update message and its class
        healthMsg.textContent = msg;
        healthMsg.className = `battery-health-message ${cls}`;

        // Update card colors
        if (flipBack) {
          flipBack.className = `flip-card-back ${cls}`;
        }
        if (flipFront) {
          flipFront.className = `flip-card-front ${cls}`;
        }
      }

      // Update coolant health status
      const coolantValue = obdData.coolant;
      const coolantHealthMsg = document.getElementById(
        "coolant-health-message"
      );
      const coolantCard = document.getElementById("coolant-card");
      const coolantFlipBack = coolantCard.querySelector(".flip-card-back");
      const coolantFlipFront = coolantCard.querySelector(".flip-card-front");

      if (coolantHealthMsg) {
        let msg = "Normal";
        let cls = "normal";

        if (
          typeof coolantValue !== "number" ||
          isNaN(coolantValue) ||
          coolantValue === 0
        ) {
          msg = "No coolant data available";
          cls = "danger";
        } else if (coolantValue < 48 || coolantValue > 110) {
          msg = "Coolant out of range (< 48°C or > 110°C)";
          cls = "danger";
        } else if (
          (coolantValue >= 48 && coolantValue < 54) ||
          (coolantValue > 104 && coolantValue <= 110)
        ) {
          msg = "Near limit (48-54°C or 104-110°C)";
          cls = "warning";
        } else {
          msg = "Normal (54°C - 104°C)";
          cls = "normal";
        }

        // Update message and its class
        coolantHealthMsg.textContent = msg;
        coolantHealthMsg.className = `coolant-health-message ${cls}`;

        // Update card colors
        if (coolantFlipBack) {
          coolantFlipBack.className = `flip-card-back ${cls}`;
        }
        if (coolantFlipFront) {
          coolantFlipFront.className = `flip-card-front ${cls}`;
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
    if (this.ws) {
      this.ws.close();
    }

    this.reconnectAttempts = 0;
    setTimeout(() => this.initializeWebSocket(), 1000);
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

  // Create WebSocket handler
  websocketHandler = new WebSocketHandler();

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
