// Chart configurations for Vehicle Monitoring System
console.log("Loading charts.js...");

// Chart configuration
const chartConfig = {
  responsive: true,
  displayModeBar: false,
  modeBarButtonsToRemove: [
    "zoomIn2d",
    "zoomOut2d",
    "autoScale2d",
    "resetScale2d",
    "hoverClosestCartesian",
    "toggleSpikelines",
  ],
  displaylogo: false,
  scrollZoom: false,
};

// Common layout settings
const commonLayout = {
  margin: { l: 50, r: 30, t: 30, b: 50 },
  font: { family: "Arial, sans-serif", size: 12 },
  paper_bgcolor: "rgba(255, 255, 255, 0.9)",
  plot_bgcolor: "rgba(255, 255, 255, 0.5)",
};

// Charts initialization status
let chartsInitialized = false;

// Data storage
const accelerometerData = {
  x: Array(20).fill(0),
  y: Array(20).fill(0),
  z: Array(20).fill(0),
  time: Array(20).fill(""),
};

const gyroscopeData = {
  x: Array(20).fill(0),
  y: Array(20).fill(0),
  z: Array(20).fill(0),
  time: Array(20).fill(""),
};

// Initialize behavior chart
function initBehaviorChart() {
  console.log("Initializing behavior chart...");

  try {
    const behaviorChartElement = document.getElementById(
      "behavior-distribution"
    );

    if (!behaviorChartElement) {
      console.error(
        "Cannot find behavior chart element with ID 'behavior-distribution'"
      );
      return false;
    }

    // Initial data for all behavior types
    const data = [
      {
        values: [16.67, 16.67, 16.67, 16.67, 16.67, 16.67],
        labels: [
          "Aggressive Acceleration",
          "Normal Acceleration",
          "Aggressive Deceleration",
          "Normal Deceleration",
          "Aggressive Lane Change",
          "Normal Lane Change",
        ],
        type: "pie",
        hole: 0.4,
        textinfo: "label+percent",
        textposition: "outside",
        automargin: true,
        marker: {
          colors: [
            "#dc3545", // Aggressive Acceleration - Red
            "#28a745", // Normal Acceleration - Green
            "#ffc107", // Aggressive Deceleration - Yellow
            "#17a2b8", // Normal Deceleration - Blue
            "#fd7e14", // Aggressive Lane Change - Orange
            "#20c997", // Normal Lane Change - Teal
          ],
          line: {
            color: "#FFFFFF",
            width: 2,
          },
        },
      },
    ];

    // Layout settings for pie chart
    const layout = {
      autosize: true,
      width: undefined, // Let it be responsive
      height: undefined, // Let it be responsive
      margin: { l: 50, r: 50, t: 30, b: 30, pad: 4 },
      showlegend: true,
      legend: {
        orientation: "h",
        xanchor: "center",
        y: -0.15,
        x: 0.5,
      },
      paper_bgcolor: "rgba(0,0,0,0)",
    };

    Plotly.newPlot("behavior-distribution", data, layout, chartConfig);
    console.log("Behavior chart initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing behavior chart:", error);
    return false;
  }
}

// Initialize accelerometer chart
function initAccelerometerChart() {
  console.log("Initializing accelerometer chart...");

  try {
    const accelChartElement = document.getElementById("accelerometer-chart");

    if (!accelChartElement) {
      console.error(
        "Cannot find accelerometer chart element with ID 'accelerometer-chart'"
      );
      return false;
    }

    const currentTime = new Date().toLocaleTimeString();
    const times = Array(20).fill(currentTime);

    const data = [
      {
        x: times,
        y: Array(20).fill(0),
        type: "scatter",
        mode: "lines",
        name: "X-axis",
        line: { color: "#ff0000", width: 2 },
      },
      {
        x: times,
        y: Array(20).fill(0),
        type: "scatter",
        mode: "lines",
        name: "Y-axis",
        line: { color: "#00ff00", width: 2 },
      },
      {
        x: times,
        y: Array(20).fill(0),
        type: "scatter",
        mode: "lines",
        name: "Z-axis",
        line: { color: "#0000ff", width: 2 },
      },
    ];

    const layout = {
      ...commonLayout,
      title: "Accelerometer Data",
      autosize: true,
      height: 400,
      xaxis: {
        title: "Time",
        showgrid: true,
        gridcolor: "rgba(200, 200, 200, 0.2)",
      },
      yaxis: {
        title: "Acceleration (g)",
        showgrid: true,
        gridcolor: "rgba(200, 200, 200, 0.2)",
        range: [-2, 2],
      },
      legend: {
        x: 0,
        y: 1,
        bgcolor: "rgba(255, 255, 255, 0.5)",
        bordercolor: "rgba(200, 200, 200, 0.5)",
        borderwidth: 1,
      },
    };

    Plotly.newPlot("accelerometer-chart", data, layout, chartConfig);
    console.log("Accelerometer chart initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing accelerometer chart:", error);
    return false;
  }
}

// Initialize gyroscope chart
function initGyroscopeChart() {
  console.log("Initializing gyroscope chart...");

  try {
    const gyroChartElement = document.getElementById("gyroscope-chart");

    if (!gyroChartElement) {
      console.error(
        "Cannot find gyroscope chart element with ID 'gyroscope-chart'"
      );
      return false;
    }

    const currentTime = new Date().toLocaleTimeString();
    const times = Array(20).fill(currentTime);

    const data = [
      {
        x: times,
        y: Array(20).fill(0),
        type: "scatter",
        mode: "lines",
        name: "X-axis",
        line: { color: "#ff0000", width: 2 },
      },
      {
        x: times,
        y: Array(20).fill(0),
        type: "scatter",
        mode: "lines",
        name: "Y-axis",
        line: { color: "#00ff00", width: 2 },
      },
      {
        x: times,
        y: Array(20).fill(0),
        type: "scatter",
        mode: "lines",
        name: "Z-axis",
        line: { color: "#0000ff", width: 2 },
      },
    ];

    const layout = {
      ...commonLayout,
      title: "Gyroscope Data",
      autosize: true,
      height: 400,
      xaxis: {
        title: "Time",
        showgrid: true,
        gridcolor: "rgba(200, 200, 200, 0.2)",
      },
      yaxis: {
        title: "Angular Velocity (deg/s)",
        showgrid: true,
        gridcolor: "rgba(200, 200, 200, 0.2)",
        range: [-180, 180],
      },
      legend: {
        x: 0,
        y: 1,
        bgcolor: "rgba(255, 255, 255, 0.5)",
        bordercolor: "rgba(200, 200, 200, 0.5)",
        borderwidth: 1,
      },
    };

    Plotly.newPlot("gyroscope-chart", data, layout, chartConfig);
    console.log("Gyroscope chart initialized successfully");
    return true;
  } catch (error) {
    console.error("Error initializing gyroscope chart:", error);
    return false;
  }
}

// Update behavior chart with new percentages
function updateBehaviorChart(percentages) {
  try {
    const values = [
      percentages.aggressive_acceleration,
      percentages.normal_acceleration,
      percentages.aggressive_deceleration,
      percentages.normal_deceleration,
      percentages.aggressive_lane_change,
      percentages.normal_lane_change,
    ];

    const update = {
      values: [values],
    };

    Plotly.update("behavior-distribution", update);
    console.log("Behavior chart updated with new values:", values);
  } catch (error) {
    console.error("Error updating behavior chart:", error);
  }
}

// Update accelerometer chart
function updateAccelerometerChart(x, y, z) {
  try {
    if (!chartsInitialized) {
      console.warn(
        "Charts not initialized yet, cannot update accelerometer chart"
      );
      return;
    }

    // Get current time as string
    const currentTime = new Date().toLocaleTimeString();

    // Shift existing data
    accelerometerData.x.shift();
    accelerometerData.y.shift();
    accelerometerData.z.shift();
    accelerometerData.time.shift();

    // Add new data
    accelerometerData.x.push(x);
    accelerometerData.y.push(y);
    accelerometerData.z.push(z);
    accelerometerData.time.push(currentTime);

    // Update chart
    const update = {
      x: [
        accelerometerData.time,
        accelerometerData.time,
        accelerometerData.time,
      ],
      y: [accelerometerData.x, accelerometerData.y, accelerometerData.z],
    };

    Plotly.update("accelerometer-chart", update);
  } catch (error) {
    console.error("Error updating accelerometer chart:", error);
  }
}

// Update gyroscope chart
function updateGyroscopeChart(x, y, z) {
  try {
    if (!chartsInitialized) {
      console.warn("Charts not initialized yet, cannot update gyroscope chart");
      return;
    }

    // Get current time as string
    const currentTime = new Date().toLocaleTimeString();

    // Shift existing data
    gyroscopeData.x.shift();
    gyroscopeData.y.shift();
    gyroscopeData.z.shift();
    gyroscopeData.time.shift();

    // Add new data
    gyroscopeData.x.push(x);
    gyroscopeData.y.push(y);
    gyroscopeData.z.push(z);
    gyroscopeData.time.push(currentTime);

    // Update chart
    const update = {
      x: [gyroscopeData.time, gyroscopeData.time, gyroscopeData.time],
      y: [gyroscopeData.x, gyroscopeData.y, gyroscopeData.z],
    };

    Plotly.update("gyroscope-chart", update);
  } catch (error) {
    console.error("Error updating gyroscope chart:", error);
  }
}

// Handle window resize
function handleResize() {
  if (chartsInitialized) {
    Plotly.relayout("behavior-distribution", {
      "xaxis.autorange": true,
      "yaxis.autorange": true,
    });

    Plotly.relayout("accelerometer-chart", {
      "xaxis.autorange": true,
      "yaxis.autorange": true,
    });

    Plotly.relayout("gyroscope-chart", {
      "xaxis.autorange": true,
      "yaxis.autorange": true,
    });
  }
}

// Initialize all charts
function initializeCharts() {
  console.log("Initializing all charts...");

  // Give the DOM a moment to fully render
  setTimeout(() => {
    const behaviorSuccess = initBehaviorChart();
    const accelSuccess = initAccelerometerChart();
    const gyroSuccess = initGyroscopeChart();

    chartsInitialized = behaviorSuccess && accelSuccess && gyroSuccess;

    if (chartsInitialized) {
      console.log("All charts initialized successfully");

      // Set up event listeners
      window.addEventListener("resize", handleResize);

      // Set up tab switching to redraw charts
      const tabElements = document.querySelectorAll('[data-bs-toggle="tab"]');
      tabElements.forEach((tabElement) => {
        tabElement.addEventListener("shown.bs.tab", (event) => {
          handleResize();
        });
      });

      // Initial behavior chart data
      updateBehaviorChart({
        aggressive_acceleration: 0,
        normal_acceleration: 0,
        aggressive_deceleration: 0,
        normal_deceleration: 0,
        aggressive_lane_change: 0,
        normal_lane_change: 0,
      });
    } else {
      console.error("Failed to initialize all charts");
    }
  }, 500);
}

// Initialize charts when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing charts...");
  initializeCharts();
});

// Export chart update functions
window.charts = {
  initializeCharts,
  updateBehaviorChart,
  updateAccelerometerChart,
  updateGyroscopeChart,
  handleResize,
};
