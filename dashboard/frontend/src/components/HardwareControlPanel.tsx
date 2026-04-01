import { useState } from "react";
import type { PlantMode, PlantState, TestScenario } from "../types";

interface Props {
  state: PlantState;
  simulationMode: boolean;
  testScenario: TestScenario;
  onSimulationChange: (enabled: boolean) => void;
  onScenarioChange: (scenario: TestScenario) => void;
  onSetpointChange: (value: number) => Promise<void>;
  onModeChange: (mode: PlantMode) => Promise<void>;
  onReset: () => Promise<void>;
}

export function HardwareControlPanel(props: Props) {
  const [setpoint, setSetpoint] = useState(String(props.state.setpoint));
  const [mode, setMode] = useState<PlantMode>(props.state.mode);
  const formatScenario = (name: string) => name.split("_").join(" ");
  const scenarioDescriptions: Record<TestScenario, string> = {
    NORMAL_OPERATION: "Stable baseline around safe thermal range with low variance.",
    GRADUAL_TEMPERATURE_RISE: "Slow ramp-up to simulate delayed cooling response and control drift.",
    RAPID_SPIKE: "Sharp transient peaks to stress alert thresholds and response timing.",
    CRITICAL_OVERHEAT: "Sustained >60C condition meant to trigger failure lock sequence.",
    SENSOR_FAILURE: "Injects sensor fault state and critical diagnostics path.",
    OSCILLATION_MODE: "Repeating thermal wave around boundary conditions for tuning checks.",
  };

  return (
    <section className="panel">
      <header className="panel-header">
        <h3>Hardware Control Panel</h3>
      </header>

      <div className="hardware-lights">
        <div className="hardware-item"><span>Buzzer</span><strong>{props.state.buzzer_on ? "ON" : "OFF"}</strong></div>
        <div className="hardware-item"><span>Green LED</span><strong>{props.state.led_ok ? "ON" : "OFF"}</strong></div>
        <div className="hardware-item"><span>Blue LED (Cooling)</span><strong>{props.state.led_holding ? "ON" : "OFF"}</strong></div>
        <div className="hardware-item"><span>Red LED</span><strong>{props.state.led_fault ? "ON" : "OFF"}</strong></div>
        <div className="hardware-item"><span>Relay</span><strong>{props.state.relay_on ? "ON" : "OFF"}</strong></div>
      </div>

      <div className="switch-row">
        <label>Simulation Mode</label>
        <button className={`switch ${props.simulationMode ? "switch-on" : ""}`} onClick={() => props.onSimulationChange(!props.simulationMode)}>
          {props.simulationMode ? "ENABLED" : "DISABLED"}
        </button>
      </div>

      <div className="test-buttons">
        <button
          disabled={!props.simulationMode}
          className={props.testScenario === "NORMAL_OPERATION" ? "scenario-active" : ""}
          onClick={() => props.onScenarioChange("NORMAL_OPERATION")}
        >
          Normal Operation
        </button>
        <button
          disabled={!props.simulationMode}
          className={props.testScenario === "GRADUAL_TEMPERATURE_RISE" ? "scenario-active" : ""}
          onClick={() => props.onScenarioChange("GRADUAL_TEMPERATURE_RISE")}
        >
          Gradual Temperature Rise
        </button>
        <button
          disabled={!props.simulationMode}
          className={props.testScenario === "RAPID_SPIKE" ? "scenario-active" : ""}
          onClick={() => props.onScenarioChange("RAPID_SPIKE")}
        >
          Rapid Spike
        </button>
        <button
          disabled={!props.simulationMode}
          className={props.testScenario === "CRITICAL_OVERHEAT" ? "scenario-active" : ""}
          onClick={() => props.onScenarioChange("CRITICAL_OVERHEAT")}
        >
          Critical Overheat
        </button>
        <button
          disabled={!props.simulationMode}
          className={props.testScenario === "SENSOR_FAILURE" ? "scenario-active" : ""}
          onClick={() => props.onScenarioChange("SENSOR_FAILURE")}
        >
          Sensor Failure
        </button>
        <button
          disabled={!props.simulationMode}
          className={props.testScenario === "OSCILLATION_MODE" ? "scenario-active" : ""}
          onClick={() => props.onScenarioChange("OSCILLATION_MODE")}
        >
          Oscillation Mode
        </button>
      </div>

      <details className="scenario-guide">
        <summary>Simulation Scenario Guide</summary>
        <div className="scenario-guide-body">
          <p className="scenario-active-line">
            Active: <strong>{formatScenario(props.testScenario)}</strong>
          </p>
          <p>{scenarioDescriptions[props.testScenario]}</p>
          <ul>
            {Object.entries(scenarioDescriptions).map(([key, value]) => (
              <li key={key}>
                <strong>{formatScenario(key)}</strong> - {value}
              </li>
            ))}
          </ul>
        </div>
      </details>

      <div className="forms-row">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void props.onSetpointChange(Number(setpoint));
          }}
        >
          <label>Setpoint</label>
          <input value={setpoint} type="number" min={10} max={80} onChange={(e) => setSetpoint(e.target.value)} />
          <button type="submit">Apply Setpoint</button>
        </form>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void props.onModeChange(mode);
          }}
        >
          <label>Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as PlantMode)}>
            <option value="OFF">OFF</option>
            <option value="MANUAL">MANUAL</option>
            <option value="AUTO">AUTO</option>
          </select>
          <button type="submit">Apply Mode</button>
        </form>
      </div>

      <button className="reset-btn" onClick={() => void props.onReset()}>
        Manual Trip Reset
      </button>
    </section>
  );
}
