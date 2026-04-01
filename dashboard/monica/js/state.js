function updateStateUI(state) {
  document.getElementById("temperature").textContent =
    `${state.temperature.toFixed(1)} °C`;

  document.getElementById("setpoint").textContent =
    `${state.setpoint.toFixed(1)} °C`;

  document.getElementById("mode").textContent = state.mode;

  document.getElementById("trip").innerHTML = state.trip
    ? `<span class="trip">YES - ${state.trip_reason}</span>`
    : "NO";
}
