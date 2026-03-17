async function refresh() {
  const state = await apiGetState();
  updateStateUI(state);
  updateGraph(state.temperature);
}

refresh();
setInterval(refresh, 1000);
