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

const DEBUG = false; // Set to true for development logging
let lastBehaviorChartUpdate = 0;
let lastBehaviorChartValues = null;

function safeLog(...args) {
  if (DEBUG) console.log(...args);
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

// Update behavior chart with new percentages
function updateBehaviorChart(percentages) {
  try {
    const now = Date.now();
    if (now - lastBehaviorChartUpdate < 200) return;
    const values = [
      percentages.aggressive_acceleration,
      percentages.normal_acceleration,
      percentages.aggressive_deceleration,
      percentages.normal_deceleration,
      percentages.aggressive_lane_change,
      percentages.normal_lane_change,
    ];
    if (
      lastBehaviorChartValues &&
      JSON.stringify(values) === JSON.stringify(lastBehaviorChartValues)
    )
      return;
    lastBehaviorChartValues = values;
    lastBehaviorChartUpdate = now;
    const update = {
      values: [values],
    };
    Plotly.update("behavior-distribution", update);
    safeLog("Behavior chart updated with new values:", values);
  } catch (error) {
    console.error("Error updating behavior chart:", error);
  }
}

// Update accelerometer display
function updateAccelerometerDisplay(x, y, z) {
  try {
    safeLog("Updating accelerometer display with values:", { x, y, z });
    document.getElementById("accel-x").textContent = x.toFixed(2);
    document.getElementById("accel-y").textContent = y.toFixed(2);
    document.getElementById("accel-z").textContent = z.toFixed(2);
  } catch (error) {
    console.error("Error updating accelerometer display:", error);
  }
}

// Update gyroscope display
function updateGyroscopeDisplay(x, y, z) {
  try {
    safeLog("Updating gyroscope display with values:", { x, y, z });
    document.getElementById("gyro-x").textContent = x.toFixed(2);
    document.getElementById("gyro-y").textContent = y.toFixed(2);
    document.getElementById("gyro-z").textContent = z.toFixed(2);
  } catch (error) {
    console.error("Error updating gyroscope display:", error);
  }
}

// Handle window resize
function handleResize() {
  if (chartsInitialized) {
    Plotly.relayout("behavior-distribution", {
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
    chartsInitialized = behaviorSuccess;

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
  updateAccelerometerDisplay,
  updateGyroscopeDisplay,
  handleResize,
};
