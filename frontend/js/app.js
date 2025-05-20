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
    this.currentEventsPage = 1;
    this.eventsLoading = false;
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

      // If events tab, load events
      if (tabId === "events") {
        this.currentEventsPage = 1;
        this.loadEvents(true);
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

    // Events tab filters
    const eventTypeFilter = document.getElementById("event-type-filter");
    const timeFilter = document.getElementById("time-filter");
    const loadMoreBtn = document.getElementById("load-more-events");

    if (eventTypeFilter) {
      eventTypeFilter.addEventListener("change", () => {
        this.currentEventsPage = 1;
        this.loadEvents(true);
      });
    }

    if (timeFilter) {
      timeFilter.addEventListener("change", () => {
        this.currentEventsPage = 1;
        this.loadEvents(true);
      });
    }

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", () => {
        this.currentEventsPage++;
        this.loadEvents(false);
      });
    }
  }

  setupWebSocket() {
    if (!window.wsHandler) {
      console.error("WebSocket handler not initialized");
      return;
    }

    window.wsHandler.onData = (data) => {
      this.updateRealTimeData(data);
      if (data.behavior_summary) {
        this.updateBehaviorSummary(data.behavior_summary);
      }
    };

    window.wsHandler.onStatusChange = (connected) => {
      this.updateConnectionStatus(connected);
    };
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
    // Update motion data displays
    if (data.sensor_data && window.charts) {
      if (typeof window.charts.updateAccelerometerDisplay === "function") {
        const accel = data.sensor_data.accelerometer;
        window.charts.updateAccelerometerDisplay(accel.x, accel.y, accel.z);
      }
      if (typeof window.charts.updateGyroscopeDisplay === "function") {
        const gyro = data.sensor_data.gyroscope;
        window.charts.updateGyroscopeDisplay(gyro.x, gyro.y, gyro.z);
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
    // If we have a WebSocket handler, use its update function
    if (window.wsHandler) {
      window.wsHandler.updateOBDMetrics(data);
    } else {
      console.warn("WebSocket handler not available for OBD updates");
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

  async loadEvents(clearList = true) {
    if (this.eventsLoading) return;

    const eventsList = document.getElementById("historical-events-list");
    const loadMoreBtn = document.getElementById("load-more-events");
    if (!eventsList || !loadMoreBtn) {
      console.error("Required DOM elements not found");
      return;
    }

    this.eventsLoading = true;
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = "Loading...";

    try {
      const eventType =
        document.getElementById("event-type-filter")?.value || "all";
      const timeFilter = document.getElementById("time-filter")?.value || "all";

      // Create cache key for this query
      const cacheKey = `events_${eventType}_${timeFilter}_${this.currentEventsPage}`;

      // Check if we have cached data for this query
      const cachedData = sessionStorage.getItem(cacheKey);
      let data;

      if (cachedData) {
        // Use cached data
        console.log("Using cached events data");
        data = JSON.parse(cachedData);
      } else {
        // Fetch fresh data
        console.log("Fetching events with params:", {
          type: eventType,
          time: timeFilter,
          page: this.currentEventsPage,
        });

        const hostname = window.location.hostname || "localhost";
        const url = `${window.location.protocol}//${hostname}:8000/events?type=${eventType}&time=${timeFilter}&page=${this.currentEventsPage}&per_page=20`;

        console.log("Fetching from URL:", url);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        try {
          const response = await fetch(url, {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          console.log("Response status:", response.status);
          data = await response.json();
          console.log("Response data:", data);

          if (!response.ok) {
            throw new Error(
              data.error || `HTTP error! status: ${response.status}`
            );
          }

          // Cache the response for future use
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError.name === "AbortError") {
            throw new Error("Request timed out. Please try again.");
          }
          throw fetchError;
        }
      }

      if (clearList) {
        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        eventsList.innerHTML = "";

        if (!data.events || data.events.length === 0) {
          const noEventsItem = document.createElement("div");
          noEventsItem.className = "historical-event-item";
          noEventsItem.textContent = "No events found";
          fragment.appendChild(noEventsItem);
          eventsList.appendChild(fragment);
          loadMoreBtn.style.display = "none";
          return;
        }

        // Reuse event elements for better memory efficiency
        const renderEvent = (event) => {
          const eventItem = document.createElement("div");
          eventItem.className = "historical-event-item";

          let eventIcon = "🚗"; // Default icon
          switch (event.type) {
            case "aggressive_acceleration":
              eventIcon = "🚀";
              break;
            case "normal_acceleration":
              eventIcon = "✅";
              break;
            case "aggressive_deceleration":
              eventIcon = "🛑";
              break;
            case "normal_deceleration":
              eventIcon = "🟢";
              break;
            case "aggressive_lane_change":
              eventIcon = "↔️";
              break;
            case "normal_lane_change":
              eventIcon = "➡️";
              break;
          }

          const eventTime = new Date(event.timestamp).toLocaleString();
          const eventSpeed = event.speed
            ? `${event.speed.toFixed(1)} km/h`
            : "N/A";
          const confidence = event.confidence
            ? `${(event.confidence * 100).toFixed(1)}%`
            : "N/A";

          // Avoid innerHTML for better performance
          const eventDetails = document.createElement("div");
          eventDetails.className = "event-details";

          const iconSpan = document.createElement("span");
          iconSpan.className = "event-icon";
          iconSpan.textContent = eventIcon;

          const infoDiv = document.createElement("div");
          infoDiv.className = "event-info";

          const typeSpan = document.createElement("span");
          typeSpan.className = "event-type";
          typeSpan.textContent = this.formatEventType(event.type);

          const metaSpan = document.createElement("span");
          metaSpan.className = "event-metadata";
          metaSpan.textContent = `Speed: ${eventSpeed} | Confidence: ${confidence}`;

          infoDiv.appendChild(typeSpan);
          infoDiv.appendChild(metaSpan);

          eventDetails.appendChild(iconSpan);
          eventDetails.appendChild(infoDiv);

          const timestampSpan = document.createElement("span");
          timestampSpan.className = "event-timestamp";
          timestampSpan.textContent = eventTime;

          eventItem.appendChild(eventDetails);
          eventItem.appendChild(timestampSpan);

          return eventItem;
        };

        // Use requestAnimationFrame for smoother rendering when adding many events
        const renderEvents = (events, startIdx = 0) => {
          const chunkSize = 5; // Process 5 events per frame
          const endIdx = Math.min(startIdx + chunkSize, events.length);

          for (let i = startIdx; i < endIdx; i++) {
            fragment.appendChild(renderEvent(events[i]));
          }

          if (endIdx < events.length) {
            // Process next chunk in next animation frame
            requestAnimationFrame(() => renderEvents(events, endIdx));
          } else {
            // Done with all events, append fragment to DOM
            eventsList.appendChild(fragment);
          }
        };

        renderEvents(data.events);
      } else {
        // Add new events to existing list
        const fragment = document.createDocumentFragment();
        data.events.forEach((event) => {
          const eventItem = document.createElement("div");
          eventItem.className = "historical-event-item";

          let eventIcon = "🚗"; // Default icon
          switch (event.type) {
            case "aggressive_acceleration":
              eventIcon = "🚀";
              break;
            case "normal_acceleration":
              eventIcon = "✅";
              break;
            case "aggressive_deceleration":
              eventIcon = "🛑";
              break;
            case "normal_deceleration":
              eventIcon = "🟢";
              break;
            case "aggressive_lane_change":
              eventIcon = "↔️";
              break;
            case "normal_lane_change":
              eventIcon = "➡️";
              break;
          }

          const eventTime = new Date(event.timestamp).toLocaleString();
          const eventSpeed = event.speed
            ? `${event.speed.toFixed(1)} km/h`
            : "N/A";
          const confidence = event.confidence
            ? `${(event.confidence * 100).toFixed(1)}%`
            : "N/A";

          eventItem.innerHTML = `
            <div class="event-details">
              <span class="event-icon">${eventIcon}</span>
              <div class="event-info">
                <span class="event-type">${this.formatEventType(
                  event.type
                )}</span>
                <span class="event-metadata">Speed: ${eventSpeed} | Confidence: ${confidence}</span>
              </div>
            </div>
            <span class="event-timestamp">${eventTime}</span>
          `;

          fragment.appendChild(eventItem);
        });
        eventsList.appendChild(fragment);
      }

      // Update load more button
      loadMoreBtn.style.display =
        this.currentEventsPage < data.pagination.total_pages ? "block" : "none";
    } catch (error) {
      console.error("Failed to load events:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });
      eventsList.innerHTML +=
        '<div class="error-message">Failed to load events. Please try again.</div>';
    } finally {
      this.eventsLoading = false;
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = "Load More";
    }
  }

  formatEventType(type) {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
}

// Initialize application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.appInstance = new App();
});
