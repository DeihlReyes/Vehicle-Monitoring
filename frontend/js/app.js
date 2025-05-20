// Define global behavior functions first - before any class definitions
// This ensures they're available immediately
window.app = {
  updateBehaviorStatus: function (status) {
    console.log("Global updateBehaviorStatus called with:", status);
    const behaviorStatus = document.getElementById("behavior-status");
    if (!behaviorStatus) {
      console.error("Behavior status element not found");
      return;
    }

    behaviorStatus.textContent = status;
    behaviorStatus.className =
      "behavior-indicator " +
      (status.toLowerCase().includes("aggressive") ? "aggressive" : "normal");
  },

  addEvent: function (event) {
    console.log("Global addEvent called with:", event);
    const eventsList = document.getElementById("events-list");
    if (!eventsList) {
      console.error("Events list element not found");
      return;
    }

    const eventItem = document.createElement("div");
    eventItem.className = "event-item";

    // Format the time
    const time = event.timestamp
      ? new Date(event.timestamp).toLocaleTimeString()
      : new Date().toLocaleTimeString();

    // Format the event type to be more user-friendly
    let eventType = event.type || "Unknown";
    if (eventType.includes("_")) {
      // Convert aggressive_braking to Aggressive Braking
      eventType = eventType
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    } else {
      // Just capitalize first letter
      eventType = eventType.charAt(0).toUpperCase() + eventType.slice(1);
    }

    // Add colored badge based on event type
    const isAggressive = (event.type || "").includes("aggressive");

    eventItem.innerHTML = `
      <span class="event-badge ${
        isAggressive ? "aggressive" : "normal"
      }">${eventType}</span>
      <span class="event-time">${time}</span>
    `;

    eventsList.insertBefore(eventItem, eventsList.firstChild);

    // Keep only last 10 events
    while (eventsList.children.length > 10) {
      eventsList.removeChild(eventsList.lastChild);
    }
  },

  updateOBDMetrics: function (data) {
    console.log("Global updateOBDMetrics called with:", data);
    const updateElement = function (id, value, unit = "") {
      const element = document.getElementById(id);
      if (element) {
        element.textContent =
          value !== null && value !== undefined
            ? `${typeof value === "number" ? value.toFixed(1) : value}${unit}`
            : "N/A";
      }
    };

    updateElement("rpm-value", data.rpm);
    updateElement("speed-value", data.speed, " km/h");
    updateElement("throttle-value", data.throttle, "%");
    updateElement("coolant-temp", data.coolant, "°C");
    updateElement("intake-temp", data.intake, " kPa");
    updateElement("battery-voltage", data.battery, "V");
    updateElement("engine-load", data.engineLoad, "%");
  },
};

class App {
  constructor() {
    this.currentTab = "dashboard";
    this.batteryVoltage = null;
    this.initializeApp();
  }

  async initializeApp() {
    try {
      // First, initialize charts
      if (
        window.charts &&
        typeof window.charts.initializeCharts === "function"
      ) {
        await window.charts.initializeCharts();
      } else {
        console.error("Charts module not loaded properly");
      }

      // Then setup other components
      this.setupEventListeners();
      this.setupWebSocket();
      this.loadInitialData();
    } catch (error) {
      console.error("Error initializing app:", error);
    }
  }

  setupEventListeners() {
    // Tab switching
    const tabButtons = document.querySelectorAll(".nav-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    // Tab switching functionality
    const switchTab = (tabId) => {
      // Hide all tabs
      tabContents.forEach((tab) => {
        tab.classList.add("hidden");
      });

      // Remove active class from all buttons
      tabButtons.forEach((btn) => {
        btn.classList.remove("active");
      });

      // Show selected tab
      const selectedTab = document.getElementById(`${tabId}-tab`);
      if (selectedTab) {
        selectedTab.classList.remove("hidden");
      }

      // Activate selected button
      const selectedBtn = document.querySelector(`[data-tab="${tabId}"]`);
      if (selectedBtn) {
        selectedBtn.classList.add("active");
      }

      // Store current tab
      this.currentTab = tabId;

      // If system tab, reload logs
      if (tabId === "system") {
        this.loadAndRenderLogs();
      }

      // Trigger resize event for charts
      if (window.charts && typeof window.charts.handleResize === "function") {
        setTimeout(() => window.charts.handleResize(), 100);
      }
    };

    // Event listeners for tab buttons
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const tabId = button.getAttribute("data-tab");
        switchTab(tabId);
      });
    });

    // Start with dashboard tab
    switchTab("dashboard");

    // Handle window resize for charts
    window.addEventListener("resize", this.handleResize.bind(this));

    // Battery card flip logic
    const batteryCard = document.getElementById("battery-card");
    if (batteryCard) {
      batteryCard.addEventListener("click", () => {
        batteryCard.classList.toggle("flipped");
      });
    }
    // Coolant card flip logic
    const coolantCard = document.getElementById("coolant-card");
    if (coolantCard) {
      coolantCard.addEventListener("click", () => {
        coolantCard.classList.toggle("flipped");
      });
    }
  }

  setupWebSocket() {
    if (!window.wsHandler) {
      console.error("WebSocket handler not initialized");
      return;
    }

    window.wsHandler.onData((data) => {
      this.updateRealTimeData(data);
      if (data.behavior_summary) {
        this.updateBehaviorSummary(data.behavior_summary);
      }
    });

    window.wsHandler.onStatusChange((connected) => {
      this.updateConnectionStatus(connected);
    });
  }

  async loadInitialData() {
    // No HTTP fetches; all data comes from WebSocket now.
    return;
  }

  async loadAndRenderLogs() {
    // No HTTP fetches; logs must be sent via WebSocket if needed.
    return;
  }

  updateRealTimeData(data) {
    // Update motion data charts
    if (data.sensor_data && window.charts) {
      if (typeof window.charts.updateAccelerometerChart === "function") {
        window.charts.updateAccelerometerChart(data.sensor_data.accelerometer);
      }
      if (typeof window.charts.updateGyroscopeChart === "function") {
        window.charts.updateGyroscopeChart(data.sensor_data.gyroscope);
      }
    }

    // Update OBD data
    if (data.obd_data) {
      this.updateOBDDisplay(data.obd_data);
    }

    // Update system status
    if (data.system_health) {
      this.updateSystemStatus(data.system_health);
    }

    // Update behavior status
    if (data.behavior) {
      this.updateBehaviorStatus(data.behavior);
    }
  }

  updateSessionsList(sessions) {
    const container = document.getElementById("sessions-list");
    if (!container) return;

    container.innerHTML = sessions
      .map(
        (session) => `
          <div class="session-item">
            <div class="d-flex justify-content-between">
              <span>${new Date(session.start_time).toLocaleString()}</span>
              <span class="badge ${
                session.total_aggressive_events > 5 ? "bg-danger" : "bg-success"
              }">
                ${session.total_aggressive_events} events
              </span>
            </div>
            <div class="small text-muted">
              Max Speed: ${session.max_speed?.toFixed(1) || 0} km/h | 
              Avg Speed: ${session.average_speed?.toFixed(1) || 0} km/h
            </div>
          </div>
        `
      )
      .join("");
  }

  updateOBDDisplay(data) {
    const updateElement = (id, value, unit = "") => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent =
          value !== null && value !== undefined
            ? `${value.toFixed(1)}${unit}`
            : "N/A";
      }
    };

    // Handle either direct properties (from websocket) or nested ones (from API)
    updateElement("rpm-value", data.rpm || data.RPM);
    updateElement("speed-value", data.speed || data.SPEED, " km/h");
    updateElement("throttle-value", data.throttle || data.THROTTLE_POS, "%");
    updateElement("coolant-temp", data.coolant || data.COOLANT_TEMP, "°C");
    updateElement("intake-temp", data.intake || data.INTAKE_PRESSURE, " kPa");
    const voltage = data.battery || data.CONTROL_MODULE_VOLTAGE;
    updateElement("battery-voltage", voltage, "V");
    updateElement("engine-load", data.engineLoad || data.ENGINE_LOAD, "%");

    // Battery health logic
    this.batteryVoltage = voltage;
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
        msg = "Warning: Weak or failing battery (< 12.0V)";
        cls = "danger";
      } else if (voltageValue > 14.5) {
        msg = "Warning: Overcharging (> 14.5V)";
        cls = "warning";
      } else {
        msg = "Battery voltage normal (12.0V - 14.5V)";
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

    // Coolant health logic
    const coolantValue = data.coolant || data.COOLANT_TEMP;
    const coolantHealthMsg = document.getElementById("coolant-health-message");
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
        msg = "Danger: Coolant out of range (< 48°C or > 110°C)";
        cls = "danger";
      } else if (
        (coolantValue >= 48 && coolantValue < 54) ||
        (coolantValue > 104 && coolantValue <= 110)
      ) {
        msg = "Warning: Near limit (48-54°C or 104-110°C)";
        cls = "warning";
      } else {
        msg = "Coolant temperature normal (54°C - 104°C)";
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
  }

  updateSystemStatus(health) {
    const statusClasses = {
      ok: "status-ok",
      warning: "status-warning",
      error: "status-error",
    };

    const statusIndicator = document.createElement("div");
    statusIndicator.className = `status-indicator ${
      statusClasses[health.status] || statusClasses.error
    }`;

    const statusText = document.createElement("span");
    statusText.textContent = `System Status: ${health.status.toUpperCase()}`;

    const statusContainer = document.getElementById("system-status");
    if (statusContainer) {
      statusContainer.innerHTML = "";
      statusContainer.append(statusIndicator, statusText);
    }
  }

  updateConnectionStatus(connected) {
    const statusContainer = document.getElementById("system-status");
    if (!statusContainer) return;

    const connectionStatus = document.createElement("div");
    connectionStatus.className = `connection-status ${
      connected ? "connected" : "disconnected"
    }`;
    connectionStatus.textContent = `Connection: ${
      connected ? "Connected" : "Disconnected"
    }`;

    // Remove any existing connection status before adding new one
    const existingStatus = statusContainer.querySelector(".connection-status");
    if (existingStatus) {
      existingStatus.remove();
    }
    statusContainer.prepend(connectionStatus);
  }

  updateBehaviorSummary(summary) {
    // Update the behavior summary counts in the dashboard
    const types = [
      "aggressive_acceleration",
      "normal_acceleration",
      "aggressive_deceleration",
      "normal_deceleration",
      "aggressive_lane_change",
      "normal_lane_change",
    ];
    types.forEach((type) => {
      const el = document.getElementById(`${type}-count`);
      if (el && summary[type] !== undefined) {
        el.textContent = summary[type];
      }
    });
  }

  handleResize() {
    if (window.charts && typeof window.charts.handleResize === "function") {
      window.charts.handleResize();
    }
  }
}

// Initialize application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.appInstance = new App();
});
