const labels = [];
const dataPoints = [];

const ctx = document.getElementById("tempChart").getContext("2d");

const tempChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: labels,
    datasets: [
      {
        label: "Temperature (°C)",
        data: dataPoints,
        tension: 0.2
      }
    ]
  },
  options: {
    responsive: true,
    scales: { y: { beginAtZero: false } }
  }
});

function updateGraph(temp) {
  const now = new Date().toLocaleTimeString();
  labels.push(now);
  dataPoints.push(temp);

  if (labels.length > 20) {
    labels.shift();
    dataPoints.shift();
  }

  tempChart.update();
}
