class App {
  constructor() {
    this.currentTab = "dashboard";
    this.setupEventListeners();
    this.setupWebSocket();
    this.loadInitialData();
  }

  setupEventListeners() {
    // Tab switching
    const tabButtons = document.querySelectorAll(".nav-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    // Tab switching functionality
    function switchTab(tabId) {
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

      // Trigger resize event for charts
      window.dispatchEvent(new Event("resize"));
    }

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
    wsHandler.onData((data) => {
      this.updateRealTimeData(data);
    });

    wsHandler.onStatusChange((connected) => {
      this.updateConnectionStatus(connected);
    });
  }

  async loadInitialData() {
    try {
      // Load recent sessions
      const sessionsResponse = await fetch("/sessions/recent");
      const sessions = await sessionsResponse.json();
      this.updateSessionsList(sessions);

      // Load behavior statistics
      const statsResponse = await fetch("/statistics/behavior");
      const stats = await statsResponse.json();
      chartManager.updateBehaviorStats(stats);
    } catch (error) {
      console.error("Failed to load initial data:", error);
    }
  }

  updateRealTimeData(data) {
    // Update motion data charts
    if (data.sensor_data) {
      chartManager.updateMotionData(data.sensor_data);
    }

    // Update OBD data
    if (data.obd_data) {
      chartManager.updateOBDData(data.obd_data);
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
    container.innerHTML = sessions
      .map(
        (session) => `
            <div class="session-item">
                <div class="d-flex justify-content-between">
                    <span>${new Date(
                      session.start_time
                    ).toLocaleString()}</span>
                    <span class="badge ${
                      session.total_aggressive_events > 5
                        ? "bg-danger"
                        : "bg-success"
                    }">
                        ${session.total_aggressive_events} events
                    </span>
                </div>
                <div class="small text-muted">
                    Max Speed: ${session.max_speed.toFixed(1)} km/h | 
                    Avg Speed: ${session.average_speed.toFixed(1)} km/h
                </div>
            </div>
        `
      )
      .join("");
  }

  updateOBDDisplay(data) {
    const systemStatus = document.getElementById("system-status");
    systemStatus.innerHTML = `
            <div class="obd-status">
                <div class="mb-2">
                    <strong>Coolant Temp:</strong> ${
                      data.COOLANT_TEMP
                        ? data.COOLANT_TEMP.toFixed(1) + "°C"
                        : "N/A"
                    }
                </div>
                <div class="mb-2">
                    <strong>Engine Load:</strong> ${
                      data.ENGINE_LOAD
                        ? data.ENGINE_LOAD.toFixed(1) + "%"
                        : "N/A"
                    }
                </div>
                <div class="mb-2">
                    <strong>Battery:</strong> ${
                      data.CONTROL_MODULE_VOLTAGE
                        ? data.CONTROL_MODULE_VOLTAGE.toFixed(1) + "V"
                        : "N/A"
                    }
                </div>
                <div>
                    <strong>Throttle:</strong> ${
                      data.THROTTLE_POS
                        ? data.THROTTLE_POS.toFixed(1) + "%"
                        : "N/A"
                    }
                </div>
            </div>
        `;
  }

  updateSystemStatus(health) {
    const statusClasses = {
      ok: "status-ok",
      warning: "status-warning",
      error: "status-error",
    };

    const statusIndicator = document.createElement("div");
    statusIndicator.className = `status-indicator ${
      statusClasses[health.status]
    }`;

    const statusText = document.createElement("span");
    statusText.textContent = `System Status: ${health.status.toUpperCase()}`;

    const statusContainer = document.getElementById("system-status");
    statusContainer.prepend(statusIndicator, statusText);
  }

  updateConnectionStatus(connected) {
    const statusContainer = document.getElementById("system-status");
    const connectionStatus = document.createElement("div");
    connectionStatus.className = `connection-status ${
      connected ? "connected" : "disconnected"
    }`;
    connectionStatus.textContent = `Connection: ${
      connected ? "Connected" : "Disconnected"
    }`;
    statusContainer.prepend(connectionStatus);
  }

  handleResize() {
    // Trigger chart resize for current tab
    if (this.currentTab === "behavior") {
      Plotly.Plots.resize("accelerometer-chart");
      Plotly.Plots.resize("gyroscope-chart");
    } else if (this.currentTab === "obd") {
      Plotly.Plots.resize("engine-gauges");
    }
  }
}

// Initialize application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.app = new App();
});

// Update behavior counts
function updateBehaviorCounts(counts) {
  const aggressiveCount = document.getElementById("aggressive-count");
  const normalCount = document.getElementById("normal-count");

  if (aggressiveCount) {
    aggressiveCount.textContent = counts.aggressive;
  }
  if (normalCount) {
    normalCount.textContent = counts.normal;
  }
}

// Add event to recent events list
function addEvent(event) {
  const eventsList = document.getElementById("events-list");
  if (!eventsList) return;

  const eventItem = document.createElement("div");
  eventItem.className = "event-item";

  const time = new Date().toLocaleTimeString();
  eventItem.innerHTML = `
    <span>${event.type}</span>
    <span>${time}</span>
  `;

  eventsList.insertBefore(eventItem, eventsList.firstChild);

  // Keep only last 10 events
  while (eventsList.children.length > 10) {
    eventsList.removeChild(eventsList.lastChild);
  }
}

// Update behavior status
function updateBehaviorStatus(status) {
  const behaviorStatus = document.getElementById("behavior-status");
  if (!behaviorStatus) return;

  behaviorStatus.textContent = status;

  // Update styling based on status
  if (status.toLowerCase().includes("aggressive")) {
    behaviorStatus.style.backgroundColor = "#ffebee";
    behaviorStatus.style.color = "#c62828";
  } else {
    behaviorStatus.style.backgroundColor = "#e8f5e9";
    behaviorStatus.style.color = "#2e7d32";
  }
}

// Update OBD metrics
function updateOBDMetrics(data) {
  // Update each metric if the element exists
  const metrics = {
    "rpm-value": data.rpm || 0,
    "speed-value": `${data.speed || 0} km/h`,
    "throttle-value": `${data.throttle || 0}%`,
    "coolant-temp": `${data.coolant || 0}°C`,
    "intake-temp": `${data.intake || 0}°C`,
    "battery-voltage": `${data.battery || 0}V`,
    "engine-load": `${data.engineLoad || 0}%`,
  };

  Object.entries(metrics).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });
}

// Export functions for use in other modules
window.app = {
  updateBehaviorCounts,
  addEvent,
  updateBehaviorStatus,
  updateOBDMetrics,
};
