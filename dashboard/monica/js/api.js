const API_BASE = "http://127.0.0.1:8000";

async function apiGetState() {
  const res = await fetch(`${API_BASE}/state`);
  return res.json();
}

async function apiSetSetpoint(value) {
  const res = await fetch(`${API_BASE}/setpoint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setpoint: value })
  });
  return res.json();
}

async function apiSetMode(value) {
  const res = await fetch(`${API_BASE}/mode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: value })
  });
  return res.json();
}

async function apiResetTrip() {
  const res = await fetch(`${API_BASE}/reset_trip`, { method: "POST" });
  return res.json();
}
