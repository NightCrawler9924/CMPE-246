const API_URL = "http://127.0.0.1:8000";

// Arrays to store graph data
const temperatureLabels = [];
const temperatureData = [];

// Create chart
const ctx = document.getElementById("tempChart").getContext("2d");
const tempChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: temperatureLabels,
    datasets: [
      {
        label: "Temperature (°C)",
        data: temperatureData,
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        tension: 0.2,
        fill: true
      }
    ]
  },
  options: {
    responsive: true,
    animation: false,
    scales: {
      y: {
        beginAtZero: false
      }
    }
  }
});

async function fetchState() {
  try {
    const response = await fetch(`${API_URL}/state`);
    const data = await response.json();

    document.getElementById("temperature").textContent = data.current_temperature;
    document.getElementById("setpoint").textContent = data.setpoint;
    document.getElementById("mode").textContent = data.mode;
    document.getElementById("trip").textContent = data.trip_status ? "TRIPPED" : "OK";

    updateTemperatureChart(data.current_temperature);
  } catch (error) {
    document.getElementById("message").textContent = "Could not fetch state.";
  }
}

function updateTemperatureChart(currentTemperature) {
  const now = new Date().toLocaleTimeString();

  temperatureLabels.push(now);
  temperatureData.push(currentTemperature);

  // Keep only the latest 10 points
  if (temperatureLabels.length > 10) {
    temperatureLabels.shift();
    temperatureData.shift();
  }

  tempChart.update();
}

async function updateSetpoint() {
  const setpointValue = parseFloat(document.getElementById("setpointInput").value);

  try {
    const response = await fetch(`${API_URL}/setpoint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ setpoint: setpointValue })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Failed to update setpoint");
    }

    document.getElementById("message").textContent = data.message;
    fetchState();
  } catch (error) {
    document.getElementById("message").textContent = error.message;
  }
}

async function updateMode() {
  const selectedMode = document.getElementById("modeSelect").value;

  try {
    const response = await fetch(`${API_URL}/mode`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ mode: selectedMode })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Failed to update mode");
    }

    document.getElementById("message").textContent = data.message;
    fetchState();
  } catch (error) {
    document.getElementById("message").textContent = error.message;
  }
}

fetchState();
setInterval(fetchState, 2000);