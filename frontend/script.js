const API_URL = "http://127.0.0.1:8000";

async function fetchState() {
  try {
    const response = await fetch(`${API_URL}/state`);
    const data = await response.json();

    document.getElementById("temperature").textContent = data.current_temperature;
    document.getElementById("setpoint").textContent = data.setpoint;
    document.getElementById("mode").textContent = data.mode;
    document.getElementById("trip").textContent = data.trip_status ? "TRIPPED" : "OK";
  } catch (error) {
    document.getElementById("message").textContent = "Could not fetch state.";
  }
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
