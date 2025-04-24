document.addEventListener("DOMContentLoaded", () => {
  const navButtons = document.querySelectorAll(".nav-button");
  const screens = document.querySelectorAll(".screen");

  // Event listener for navigating between screens
  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetScreen = button.id.replace("Button", "Screen");

      // Remove 'active' class from all buttons and screens
      navButtons.forEach((btn) => btn.classList.remove("active"));
      screens.forEach((screen) => screen.classList.remove("active"));

      // Add 'active' class to the selected button and screen
      button.classList.add("active");
      document.getElementById(targetScreen).classList.add("active");
    });
  });

  // Function to fetch dashboard data from the Flask API
  async function fetchDashboardData() {
    try {
      const response = await fetch("http://127.0.0.1:5000/api/dashboard");
      const data = await response.json();
      updateDashboard(data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    }
  }

  // Function to fetch behavior data from the Flask API
  async function fetchBehaviorData() {
    try {
      const response = await fetch("http://127.0.0.1:5000/api/behavior");
      const data = await response.json();
      updateBehavior(data);
    } catch (error) {
      console.error("Error fetching behavior data:", error);
    }
  }

  // Function to fetch OBD data from the Flask API
  async function fetchOBDData() {
    try {
      const response = await fetch("http://127.0.0.1:5000/api/obd");
      const data = await response.json();
      updateOBDInfo(data);
    } catch (error) {
      console.error("Error fetching OBD data:", error);
    }
  }

  // Function to update the dashboard screen with fetched data
  function updateDashboard(data) {
    document.getElementById("speed").textContent = data.speed
      ? data.speed + " km/h"
      : "N/A";
    document.getElementById("rpm").textContent = data.rpm
      ? data.rpm + " RPM"
      : "N/A";
    document.getElementById("throttle").textContent = data.throttle_position
      ? data.throttle_position + "%"
      : "N/A";
    document.getElementById("engineLoad").textContent = data.engine_load
      ? data.engine_load + "%"
      : "N/A";
    document.getElementById("coolantTemp").textContent = data.coolant_temp
      ? data.coolant_temp + "°C"
      : "N/A";

    // Battery Voltage (You might need to add this to your Flask API if not already there)
    document.getElementById("batteryVoltage").textContent =
      data.control_module_voltage
        ? data.control_module_voltage.toFixed(1) + " V"
        : "N/A";
  }

  // Function to update the behavior screen with fetched data
  function updateBehavior(data) {
    document.getElementById("acceleration").textContent = data.acceleration
      ? data.acceleration.toFixed(2) + " m/s²"
      : "N/A";
    document.getElementById("brakePressure").textContent = data.brake_pressure
      ? data.brake_pressure.toFixed(2) + " psi"
      : "N/A";
    document.getElementById("steeringAngle").textContent = data.steering_angle
      ? data.steering_angle.toFixed(2) + "°"
      : "N/A";
    document.getElementById("gForces").textContent = data.g_forces
      ? data.g_forces.toFixed(2) + " G"
      : "N/A";
  }

  // Function to update the OBD screen with fetched data
  function updateOBDInfo(data) {
    document.getElementById("fuelSystem").textContent = data.fuel_system
      ? data.fuel_system
      : "N/A";
    document.getElementById("o2Sensors").textContent = data.o2_sensors
      ? data.o2_sensors
      : "N/A";
    document.getElementById("intake_temp").textContent = data.intake_temp
      ? data.intake_temp + "°C"
      : "N/A";
    document.getElementById("intake_pressure").textContent = data.egr_system
      ? data.egr_system
      : "N/A";
    document.getElementById("timing_advance").textContent = data.timing_advance
      ? data.timing_advance
      : "N/A";
    document.getElementById("barometric_pressure").textContent =
      data.barometric_pressure ? data.barometric_pressure : "N/A";

    // Display error message (if any)
    document.getElementById("obdErrorMessage").textContent = data.error_message
      ? data.error_message
      : "No errors detected";
  }

  // Call API functions to load data on page load
  fetchDashboardData();
  fetchBehaviorData();
  fetchOBDData();

  // Initialize WebSocket connection
  const ws = new WebSocket(`ws://${window.location.hostname}:5000/ws`);

  // Initialize Plotly charts
  const motionChart = Plotly.newPlot(
    "motion-chart",
    [
      {
        name: "Acceleration",
        type: "scatter",
        mode: "lines",
        line: { color: "#2196F3" },
      },
    ],
    {
      title: "Motion Data",
      showlegend: true,
      xaxis: { title: "Time" },
      yaxis: { title: "m/s²" },
    }
  );

  const accelerometerChart = Plotly.newPlot(
    "accelerometer-chart",
    [
      {
        name: "X",
        type: "scatter",
        mode: "lines",
        line: { color: "#F44336" },
      },
      {
        name: "Y",
        type: "scatter",
        mode: "lines",
        line: { color: "#4CAF50" },
      },
      {
        name: "Z",
        type: "scatter",
        mode: "lines",
        line: { color: "#2196F3" },
      },
    ],
    {
      title: "Accelerometer Data",
      showlegend: true,
      xaxis: { title: "Time" },
      yaxis: { title: "m/s²" },
    }
  );

  const gyroscopeChart = Plotly.newPlot(
    "gyroscope-chart",
    [
      {
        name: "X",
        type: "scatter",
        mode: "lines",
        line: { color: "#F44336" },
      },
      {
        name: "Y",
        type: "scatter",
        mode: "lines",
        line: { color: "#4CAF50" },
      },
      {
        name: "Z",
        type: "scatter",
        mode: "lines",
        line: { color: "#2196F3" },
      },
    ],
    {
      title: "Gyroscope Data",
      showlegend: true,
      xaxis: { title: "Time" },
      yaxis: { title: "°/s" },
    }
  );

  // Initialize behavior statistics
  const behaviorStats = {
    Normal: 0,
    "Aggressive Acceleration": 0,
    "Aggressive Deceleration": 0,
    "Aggressive Lane Change": 0,
  };

  // Handle WebSocket messages
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    updateDashboard(data);
    updateBehaviorTab(data);
    updateOBDTab(data);
  };

  // Update functions for each tab
  function updateDashboard(data) {
    // Update behavior status
    const currentBehavior = document.getElementById("current-behavior");
    const confidenceLevel = document.getElementById("confidence-level");

    currentBehavior.textContent = data.behavior.behavior;
    confidenceLevel.style.width = `${data.behavior.confidence * 100}%`;

    // Update behavior statistics
    behaviorStats[data.behavior.behavior]++;
    document.getElementById("normal-count").textContent =
      behaviorStats["Normal"];
    document.getElementById("agg-accel-count").textContent =
      behaviorStats["Aggressive Acceleration"];
    document.getElementById("agg-decel-count").textContent =
      behaviorStats["Aggressive Deceleration"];
    document.getElementById("agg-lane-count").textContent =
      behaviorStats["Aggressive Lane Change"];

    // Update motion chart
    const acceleration = Math.sqrt(
      Math.pow(data.sensor_data.accelerometer.x, 2) +
        Math.pow(data.sensor_data.accelerometer.y, 2) +
        Math.pow(data.sensor_data.accelerometer.z, 2)
    );

    Plotly.extendTraces(
      "motion-chart",
      {
        y: [[acceleration]],
        x: [[new Date(data.timestamp)]],
      },
      [0]
    );
  }

  function updateBehaviorTab(data) {
    // Update accelerometer chart
    Plotly.extendTraces(
      "accelerometer-chart",
      {
        y: [
          [data.sensor_data.accelerometer.x],
          [data.sensor_data.accelerometer.y],
          [data.sensor_data.accelerometer.z],
        ],
        x: [
          [new Date(data.timestamp)],
          [new Date(data.timestamp)],
          [new Date(data.timestamp)],
        ],
      },
      [0, 1, 2]
    );

    // Update gyroscope chart
    Plotly.extendTraces(
      "gyroscope-chart",
      {
        y: [
          [data.sensor_data.gyroscope.x],
          [data.sensor_data.gyroscope.y],
          [data.sensor_data.gyroscope.z],
        ],
        x: [
          [new Date(data.timestamp)],
          [new Date(data.timestamp)],
          [new Date(data.timestamp)],
        ],
      },
      [0, 1, 2]
    );
  }

  function updateOBDTab(data) {
    // Update OBD information
    if (data.obd_data) {
      document.getElementById("speed").textContent = data.obd_data.SPEED
        ? `${data.obd_data.SPEED} km/h`
        : "--";
      document.getElementById("rpm").textContent = data.obd_data.RPM
        ? `${data.obd_data.RPM} RPM`
        : "--";
      document.getElementById("throttle").textContent = data.obd_data
        .THROTTLE_POS
        ? `${data.obd_data.THROTTLE_POS}%`
        : "--";
      document.getElementById("engine-load").textContent = data.obd_data
        .ENGINE_LOAD
        ? `${data.obd_data.ENGINE_LOAD}%`
        : "--";
      document.getElementById("coolant-temp").textContent = data.obd_data
        .COOLANT_TEMP
        ? `${data.obd_data.COOLANT_TEMP}°C`
        : "--";
      document.getElementById("intake-pressure").textContent = data.obd_data
        .INTAKE_PRESSURE
        ? `${data.obd_data.INTAKE_PRESSURE} kPa`
        : "--";
      document.getElementById("timing-advance").textContent = data.obd_data
        .TIMING_ADVANCE
        ? `${data.obd_data.TIMING_ADVANCE}°`
        : "--";
      document.getElementById("fuel-status").textContent =
        data.obd_data.FUEL_STATUS || "--";
      document.getElementById("o2-sensors").textContent =
        data.obd_data.O2_SENSORS || "--";
      document.getElementById("battery-voltage").textContent = data.obd_data
        .CONTROL_MODULE_VOLTAGE
        ? `${data.obd_data.CONTROL_MODULE_VOLTAGE}V`
        : "--";
    }
  }

  // Tab navigation
  const tabs = ["dashboard", "behavior", "obd"];
  const buttons = document.querySelectorAll(".nav-button");
  const contents = document.querySelectorAll(".tab-content");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.getAttribute("data-tab");

      // Update active states
      buttons.forEach((btn) => btn.classList.remove("active"));
      contents.forEach((content) => content.classList.remove("active"));

      button.classList.add("active");
      document.getElementById(tab).classList.add("active");
    });
  });

  // Set initial active tab
  document.querySelector('[data-tab="dashboard"]').click();
});
