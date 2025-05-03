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
  }

  setupWebSocket() {
    if (!window.wsHandler) {
      console.error("WebSocket handler not initialized");
      return;
    }

    window.wsHandler.onData((data) => {
      this.updateRealTimeData(data);
    });

    window.wsHandler.onStatusChange((connected) => {
      this.updateConnectionStatus(connected);
    });
  }

  async loadInitialData() {
    try {
      // Load latest data for current session and update dashboard immediately
      const latestDataResponse = await fetch("/sessions/current/latest_data");
      if (latestDataResponse.ok) {
        const latestData = await latestDataResponse.json();
        if (latestData && latestData.sensor_data) {
          this.updateRealTimeData(latestData);
        }
      }
      // Load behavior summary for current session and update dashboard
      const summaryResponse = await fetch("/sessions/current/behavior_summary");
      if (summaryResponse.ok) {
        const summary = await summaryResponse.json();
        this.updateBehaviorSummary(summary);
      }
      // Load recent sessions
      const sessionsResponse = await fetch("/sessions/recent");
      const sessions = await sessionsResponse.json();
      this.updateSessionsList(sessions);

      // Load behavior statistics
      const statsResponse = await fetch("/statistics/behavior");
      const stats = await statsResponse.json();
      if (
        window.charts &&
        typeof window.charts.updateBehaviorChart === "function"
      ) {
        window.charts.updateBehaviorChart(stats);
      }

      // Load logs for system tab
      await this.loadAndRenderLogs();
    } catch (error) {
      console.error("Failed to load initial data:", error);
    }
  }

  async loadAndRenderLogs() {
    try {
      const response = await fetch("/logs?limit=100");
      const logs = await response.json();
      this.renderLogs(logs);
    } catch (error) {
      console.error("Failed to load logs:", error);
    }
  }

  renderLogs(logs) {
    const debugConsole = document.getElementById("debug-console");
    if (!debugConsole) return;
    debugConsole.innerHTML = "";
    logs.reverse().forEach((log) => {
      const line = document.createElement("div");
      line.className = `log-line log-${log.level.toLowerCase()}`;
      const timeSpan = document.createElement("span");
      timeSpan.className = "log-time";
      timeSpan.textContent = log.timestamp
        ? new Date(log.timestamp).toLocaleTimeString()
        : "";
      const msgSpan = document.createElement("span");
      msgSpan.className = "log-message";
      msgSpan.textContent = log.message;
      line.appendChild(timeSpan);
      line.appendChild(msgSpan);
      debugConsole.appendChild(line);
    });
    debugConsole.scrollTop = debugConsole.scrollHeight;
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
    updateElement(
      "battery-voltage",
      data.battery || data.CONTROL_MODULE_VOLTAGE,
      "V"
    );
    updateElement("engine-load", data.engineLoad || data.ENGINE_LOAD, "%");
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
