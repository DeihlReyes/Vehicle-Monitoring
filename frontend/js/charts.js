// Chart configuration
const chartConfig = {
  responsive: true,
  displayModeBar: false,
  staticPlot: false,
  scrollZoom: false,
  showTips: false,
};

// Common layout settings
const commonLayout = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "#f8f9fa",
  margin: { t: 10, r: 10, b: 40, l: 50 },
  font: {
    family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    size: 11,
    color: "#666",
  },
  showlegend: true,
  legend: {
    orientation: "h",
    yanchor: "bottom",
    y: -0.2,
    xanchor: "center",
    x: 0.5,
    font: {
      size: 10,
    },
  },
  xaxis: {
    showgrid: true,
    gridcolor: "#e0e0e0",
    gridwidth: 1,
    linecolor: "#e0e0e0",
    linewidth: 1,
    tickfont: {
      size: 10,
    },
    zeroline: true,
    zerolinecolor: "#666",
    zerolinewidth: 1,
  },
  yaxis: {
    showgrid: true,
    gridcolor: "#e0e0e0",
    gridwidth: 1,
    linecolor: "#e0e0e0",
    linewidth: 1,
    tickfont: {
      size: 10,
    },
    zeroline: true,
    zerolinecolor: "#666",
    zerolinewidth: 1,
  },
  autosize: true,
};

// Initialize behavior distribution chart
function initBehaviorChart() {
  const data = [
    {
      values: [1, 0],
      labels: ["Normal", "Aggressive"],
      type: "pie",
      marker: {
        colors: ["#4caf50", "#f44336"],
      },
      textinfo: "label+percent",
      hole: 0.4,
      textfont: {
        size: 12,
      },
    },
  ];

  const layout = {
    ...commonLayout,
    showlegend: false,
    margin: { t: 10, r: 10, b: 10, l: 10 },
    height: undefined,
    width: undefined,
  };

  Plotly.newPlot("behavior-distribution", data, layout, chartConfig);
}

// Initialize accelerometer chart
function initAccelerometerChart() {
  const data = [
    {
      x: [0],
      y: [0],
      name: "X",
      type: "scatter",
      mode: "lines",
      line: {
        color: "#2196f3",
        width: 2,
      },
    },
    {
      x: [0],
      y: [0],
      name: "Y",
      type: "scatter",
      mode: "lines",
      line: {
        color: "#4caf50",
        width: 2,
      },
    },
    {
      x: [0],
      y: [0],
      name: "Z",
      type: "scatter",
      mode: "lines",
      line: {
        color: "#f44336",
        width: 2,
      },
    },
  ];

  const layout = {
    ...commonLayout,
    xaxis: {
      ...commonLayout.xaxis,
      title: {
        text: "Time (s)",
        font: {
          size: 11,
        },
      },
      range: [-5, 0],
    },
    yaxis: {
      ...commonLayout.yaxis,
      title: {
        text: "Acceleration (m/s²)",
        font: {
          size: 11,
        },
      },
      range: [-2, 2],
    },
    height: undefined,
    width: undefined,
  };

  Plotly.newPlot("accelerometer-chart", data, layout, chartConfig);
}

// Initialize gyroscope chart
function initGyroscopeChart() {
  const data = [
    {
      x: [0],
      y: [0],
      name: "Roll",
      type: "scatter",
      mode: "lines",
      line: {
        color: "#9c27b0",
        width: 2,
      },
    },
    {
      x: [0],
      y: [0],
      name: "Pitch",
      type: "scatter",
      mode: "lines",
      line: {
        color: "#ff9800",
        width: 2,
      },
    },
    {
      x: [0],
      y: [0],
      name: "Yaw",
      type: "scatter",
      mode: "lines",
      line: {
        color: "#795548",
        width: 2,
      },
    },
  ];

  const layout = {
    ...commonLayout,
    xaxis: {
      ...commonLayout.xaxis,
      title: {
        text: "Time (s)",
        font: {
          size: 11,
        },
      },
      range: [-5, 0],
    },
    yaxis: {
      ...commonLayout.yaxis,
      title: {
        text: "Angular Velocity (°/s)",
        font: {
          size: 11,
        },
      },
      range: [-180, 180],
    },
    height: undefined,
    width: undefined,
  };

  Plotly.newPlot("gyroscope-chart", data, layout, chartConfig);
}

// Update behavior distribution chart
function updateBehaviorChart(data) {
  const update = {
    values: [data.normal, data.aggressive],
  };
  Plotly.update("behavior-distribution", update);
}

// Update accelerometer chart
function updateAccelerometerChart(data) {
  const now = new Date();
  const time = now.getTime() / 1000; // Convert to seconds

  const update = {
    x: [[time], [time], [time]],
    y: [[data.x], [data.y], [data.z]],
  };

  Plotly.extendTraces("accelerometer-chart", update, [0, 1, 2]);

  // Update x-axis range to show last 5 seconds
  Plotly.relayout("accelerometer-chart", {
    "xaxis.range": [time - 5, time],
  });
}

// Update gyroscope chart
function updateGyroscopeChart(data) {
  const now = new Date();
  const time = now.getTime() / 1000; // Convert to seconds

  const update = {
    x: [[time], [time], [time]],
    y: [[data.roll], [data.pitch], [data.yaw]],
  };

  Plotly.extendTraces("gyroscope-chart", update, [0, 1, 2]);

  // Update x-axis range to show last 5 seconds
  Plotly.relayout("gyroscope-chart", {
    "xaxis.range": [time - 5, time],
  });
}

// Handle window resize
function handleResize() {
  const charts = [
    "accelerometer-chart",
    "gyroscope-chart",
    "behavior-distribution",
  ];
  charts.forEach((chartId) => {
    const chart = document.getElementById(chartId);
    if (chart && chart.layout) {
      Plotly.Plots.resize(chartId);
    }
  });
}

// Initialize all charts
document.addEventListener("DOMContentLoaded", () => {
  initBehaviorChart();
  initAccelerometerChart();
  initGyroscopeChart();

  // Handle window resize
  window.addEventListener("resize", handleResize);

  // Handle tab switching
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setTimeout(handleResize, 100); // Allow time for display changes
    });
  });
});

// Export functions for use in other modules
window.charts = {
  updateBehaviorChart,
  updateAccelerometerChart,
  updateGyroscopeChart,
};
