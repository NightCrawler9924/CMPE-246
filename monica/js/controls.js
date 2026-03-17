document.getElementById("btnSetpoint").onclick = async () => {
  const value = parseFloat(document.getElementById("newSetpoint").value);
  const result = await apiSetSetpoint(value);
  document.getElementById("message").textContent =
    result.message || result.detail;
};

document.getElementById("btnMode").onclick = async () => {
  const value = document.getElementById("newMode").value;
  const result = await apiSetMode(value);
  document.getElementById("message").textContent =
    result.message || result.detail;
};

document.getElementById("btnResetTrip").onclick = async () => {
  const result = await apiResetTrip();
  document.getElementById("message").textContent =
    result.message || result.detail;
};
