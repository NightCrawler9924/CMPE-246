const API_URL = "http://127.0.0.1:8000";

// ==============================
// GRAPH DATA
// ==============================
const temperatureLabels = [];
const temperatureData = [];

// ==============================
// CREATE CHART (SAFE INIT)
// ==============================
const ctx = document.getElementById("tempChart");

let tempChart = null;

if (ctx) {
  tempChart = new Chart(ctx.getContext("2d"), {
    type: "line",
    data: {
      labels: temperatureLabels,
      datasets: [
        {
          label: "Temperature (°C)",
          data: temperatureData,
          borderColor: "red", // keep red line as requested
          backgroundColor: "rgba(255, 0, 0, 0.1)",
          tension: 0.3,
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
}

// ==============================
// FETCH SYSTEM STATE
// ==============================
async function fetchState() {
  try {
    const response = await fetch(`${API_URL}/state`);
    const data = await response.json();

    // Update UI safely
    updateText("temperature", data.current_temperature);
    updateText("setpoint", data.setpoint);
    updateText("mode", data.mode);

    const tripText = data.trip_status ? "TRIPPED" : "OK";
    updateText("trip", tripText);
    updateText("relayState", data.relay_on ? "ON" : "OFF");
    updateText("buzzerState", data.buzzer_on ? "ON" : "OFF");
    updateText("ledHeatingState", data.led_heating ? "ON" : "OFF");
    updateText("ledHoldingState", data.led_holding ? "ON" : "OFF");
    updateText("ledFaultState", data.led_fault ? "ON" : "OFF");
    updateText("ledOkState", data.led_ok ? "ON" : "OFF");
    updateText("failureModeState", data.failure_mode || "NONE");

    // Update safety message
    updateSafetyStatus(data);
    updateHealthBadge(data);
    updateFailureOverlay(data);
    updateRuntimeTheme(data);

    // Update graph
    updateTemperatureChart(data.current_temperature);

  } catch (error) {
    updateText("message", "⚠️ Could not fetch state.");
  }
}

// ==============================
// UPDATE TEXT HELPER (SAFE)
// ==============================
function updateText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

// ==============================
// UPDATE GRAPH
// ==============================
function updateTemperatureChart(currentTemperature) {
  if (!tempChart) return;

  const now = new Date().toLocaleTimeString();

  temperatureLabels.push(now);
  temperatureData.push(currentTemperature);

  // Keep last 10 points
  if (temperatureLabels.length > 10) {
    temperatureLabels.shift();
    temperatureData.shift();
  }

  tempChart.update();
}

// ==============================
// UPDATE SETPOINT
// ==============================
async function updateSetpoint() {
  const input = document.getElementById("setpointInput");
  const value = parseFloat(input.value);

  if (isNaN(value)) {
    updateText("message", "⚠️ Invalid setpoint value.");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/setpoint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ setpoint: value })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Failed to update setpoint");
    }

    updateText("message", "✅ " + data.message);
    fetchState();

  } catch (error) {
    updateText("message", "❌ " + error.message);
  }
}

// ==============================
// UPDATE MODE
// ==============================
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

    updateText("message", "✅ " + data.message);
    fetchState();

  } catch (error) {
    updateText("message", "❌ " + error.message);
  }
}

// ==============================
// OPTIONAL: RESET TRIP (ONLY IF BACKEND EXISTS)
// ==============================
async function resetTrip() {
  try {
    const response = await fetch(`${API_URL}/reset`, {
      method: "POST"
    });

    const data = await response.json();

    updateText("message", "🔁 Trip reset.");
    fetchState();

  } catch (error) {
    updateText("message", "❌ Reset failed.");
  }
}

// ==============================
// SAFETY STATUS LOGIC (NEW FEATURE)
// ==============================
function updateSafetyStatus(data) {
  const msg = document.getElementById("message");
  if (!msg) return;

  const diff = data.current_temperature - data.setpoint;
  const failureMode = normalizeFailureMode(data.failure_mode);
  const isHardFailure = isFailureModeCritical(failureMode);

  if (isHardFailure) {
    msg.textContent = `🚨 CRITICAL FAILURE: ${failureMode}. Manual intervention required.`;
  } else if (data.trip_status) {
    msg.textContent = "🚨 UNSAFE: System TRIPPED!";
  } else if (diff > 0.5) {
    msg.textContent = "⚠️ WARNING: Temperature above setpoint.";
  } else if (diff < -0.5) {
    msg.textContent = "⚠️ WARNING: Temperature below setpoint.";
  } else {
    msg.textContent = "✅ SAFE: System operating normally.";
  }
}

function normalizeFailureMode(mode) {
  if (mode === null || mode === undefined) return "NONE";
  return String(mode).trim().toUpperCase();
}

function isFailureModeCritical(failureMode) {
  const criticalModes = new Set(["COMPLETE_FAILURE", "FULL_FAILURE", "FAILURE", "EMERGENCY", "SHUTDOWN"]);
  return criticalModes.has(failureMode);
}

function updateHealthBadge(data) {
  const badge = document.getElementById("systemHealthBadge");
  if (!badge) return;

  const failureMode = normalizeFailureMode(data.failure_mode);
  const isHardFailure = isFailureModeCritical(failureMode);

  if (isHardFailure) {
    badge.textContent = "Complete Failure";
  } else if (data.trip_status) {
    badge.textContent = "Tripped";
  } else {
    badge.textContent = "System Ready";
  }
}

function updateFailureOverlay(data) {
  const overlay = document.getElementById("failureOverlay");
  const overlayText = document.getElementById("failureOverlayText");
  if (!overlay || !overlayText) return;

  const failureMode = normalizeFailureMode(data.failure_mode);
  const showOverlay = isFailureModeCritical(failureMode);

  if (showOverlay) {
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    overlayText.textContent = `Failure mode: ${failureMode}. Triggering emergency response.`;
  } else {
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
  }
}

function updateRuntimeTheme(data) {
  const failureMode = normalizeFailureMode(data.failure_mode);
  const isHardFailure = isFailureModeCritical(failureMode);
  document.body.classList.toggle("state-critical", isHardFailure);
}

function demoRedScreen() {
  const overlay = document.getElementById("failureOverlay");
  const overlayText = document.getElementById("failureOverlayText");
  if (!overlay || !overlayText) return;

  overlay.classList.add("active");
  overlay.setAttribute("aria-hidden", "false");
  overlayText.textContent = "DEMO MODE: Complete failure visualization preview.";

  setTimeout(() => {
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
  }, 6000);
}

// ==============================
// AUTO REFRESH
// ==============================
fetchState();
setInterval(fetchState, 2000);
