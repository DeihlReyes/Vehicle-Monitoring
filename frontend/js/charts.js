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

// Helper function to check if a chart exists and is properly initialized
function chartExists(elementId) {
  const element = document.getElementById(elementId);
  return element && element.data && element._fullLayout;
}

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

    // If a chart already exists on this element, purge it first to avoid conflicts
    if (behaviorChartElement._fullLayout) {
      Plotly.purge(behaviorChartElement);
      console.log("Purged existing behavior chart");
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

    // Create the plot and wait for it to complete
    return new Promise((resolve) => {
      Plotly.newPlot("behavior-distribution", data, layout, chartConfig)
        .then(() => {
          console.log("Behavior chart initialized successfully");
          // Wait a moment to ensure chart is fully rendered
          setTimeout(() => {
            if (chartExists("behavior-distribution")) {
              resolve(true);
            } else {
              console.error("Chart initialized but not properly loaded in DOM");
              resolve(false);
            }
          }, 200);
        })
        .catch((error) => {
          console.error("Error in Plotly.newPlot:", error);
          resolve(false);
        });
    });
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
    if (!chartsInitialized) {
      console.warn("Charts not initialized, skipping behavior chart update");
      return;
    }

    // Check if chart exists in DOM with proper Plotly initialization
    if (!chartExists("behavior-distribution")) {
      console.warn("Behavior chart not properly initialized, cannot update");
      return;
    }

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

    try {
      Plotly.update("behavior-distribution", update);
      console.log("Behavior chart updated with new values:", values);
    } catch (error) {
      console.error("Error in Plotly.update:", error);
    }
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
    // Check if behavior chart exists before trying to relayout
    if (chartExists("behavior-distribution")) {
      try {
        Plotly.relayout("behavior-distribution", {
          autosize: true,
        });
        console.log("Chart relayout complete");
      } catch (error) {
        console.error("Error resizing behavior chart:", error);
      }
    } else {
      console.warn("Cannot resize behavior chart - not properly initialized");
    }
  }
}

// Initialize all charts
async function initializeCharts() {
  console.log("Initializing charts...");

  // Give the DOM a moment to fully render
  return new Promise((resolve) => {
    setTimeout(async () => {
      try {
        // Initialize behavior chart and await the result
        const behaviorSuccess = await initBehaviorChart();

        // Set the charts initialized flag
        chartsInitialized = behaviorSuccess;

        if (chartsInitialized) {
          console.log("Charts initialized successfully");

          // Set up event listeners
          window.addEventListener("resize", handleResize);

          // Initial behavior chart data
          updateBehaviorChart({
            aggressive_acceleration: 0,
            normal_acceleration: 0,
            aggressive_deceleration: 0,
            normal_deceleration: 0,
            aggressive_lane_change: 0,
            normal_lane_change: 0,
          });

          resolve(true);
        } else {
          console.error("Failed to initialize charts");
          resolve(false);
        }
      } catch (error) {
        console.error("Error during chart initialization:", error);
        chartsInitialized = false;
        resolve(false);
      }
    }, 800); // Increased timeout to ensure DOM is fully ready
  });
}

// Initialize charts when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, preparing to initialize charts...");

  // Wait a moment to ensure all scripts are fully loaded
  setTimeout(async () => {
    try {
      console.log("Starting chart initialization");
      const success = await initializeCharts();
      console.log("Chart initialization complete, success:", success);
    } catch (error) {
      console.error("Error in charts initialization:", error);
    }
  }, 300);
});

// Export chart update functions
window.charts = {
  initializeCharts,
  updateBehaviorChart,
  // Still export these functions to avoid breaking code that might call them
  updateAccelerometerChart: function () {
    console.log("Accelerometer chart updates disabled");
  },
  updateGyroscopeChart: function () {
    console.log("Gyroscope chart updates disabled");
  },
  handleResize,
};
