import type { SystemLevel } from "../types";

function Dot({ active, tone }: { active: boolean; tone: "green" | "amber" | "red" | "blue" }) {
  return <span className={`led led-${tone} ${active ? "led-on led-pulse" : "led-off"}`} />;
}

export function SystemStatusPanel({
  level,
  connected,
  failureMode,
}: {
  level: SystemLevel;
  connected: boolean;
  failureMode: string;
}) {
  const cooling = level === "WARNING";
  const critical = level === "CRITICAL";
  const online = level === "ONLINE";

  return (
    <section className="panel">
      <header className="panel-header">
        <h3>System Status</h3>
      </header>
      <div className="status-grid">
        <div className="status-row">
          <span>SYSTEM</span>
          <div>
            <Dot active={online} tone="green" /> ONLINE
            <Dot active={cooling} tone="blue" /> COOLING
            <Dot active={critical} tone="red" /> CRITICAL
          </div>
        </div>
        <div className="status-row">
          <span>SENSOR STATUS</span>
          <div>
            <Dot active={connected} tone="green" /> {connected ? "CONNECTED" : "DISCONNECTED"}
          </div>
        </div>
        <div className="status-row">
          <span>DATA STREAM</span>
          <div>
            <Dot active={connected} tone="blue" /> {connected ? "ACTIVE" : "RETRYING"}
          </div>
        </div>
        <div className="status-row">
          <span>FAILURE MODE</span>
          <div>{failureMode}</div>
        </div>
      </div>
    </section>
  );
}
