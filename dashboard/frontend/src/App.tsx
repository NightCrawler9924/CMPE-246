import { useEffect } from "react";
import { Activity, Cpu, RadioTower } from "lucide-react";
import { BootOverlay } from "./components/BootOverlay";
import { ReactorCorePanel } from "./components/ReactorCorePanel";
import { SystemStatusPanel } from "./components/SystemStatusPanel";
import { HardwareControlPanel } from "./components/HardwareControlPanel";
import { AlertsLogPanel } from "./components/AlertsLogPanel";
import { OpsTutorialPanel } from "./components/OpsTutorialPanel";
import { FailureScreen } from "./components/FailureScreen";
import { ContributorsFooter } from "./components/ContributorsFooter";
import { useReactorStore } from "./store/reactorStore";

export default function App() {
  const {
    state,
    stream,
    logs,
    simulationMode,
    testScenario,
    connected,
    booting,
    failureLatched,
    systemLevel,
    start,
    stop,
    setSimulationMode,
    setTestScenario,
    changeMode,
    changeSetpoint,
    resetTrip,
    emergencyShutdown,
  } = useReactorStore();

  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  return (
    <>
      <div className={`app-shell ${failureLatched ? "app-locked" : ""}`}>
        <header className="topbar">
          <div>
            <p className="eyebrow">REACTOR SENTINEL COMMAND NETWORK</p>
            <h1>Nuclear Reactor Control Interface</h1>
          </div>
          <div className="top-status">
            <span><Activity size={14} /> Level: {systemLevel}</span>
            <span><Cpu size={14} /> Mode: {state.mode}</span>
            <span><RadioTower size={14} /> {connected ? "Data Link Stable" : "Data Link Degraded"}</span>
          </div>
        </header>

        <main className="layout-grid">
          <ReactorCorePanel stream={stream} currentTemp={state.current_temperature} setpoint={state.setpoint} />
          <SystemStatusPanel level={systemLevel} connected={connected} failureMode={state.failure_mode} />
          <HardwareControlPanel
            state={state}
            simulationMode={simulationMode}
            testScenario={testScenario}
            onSimulationChange={setSimulationMode}
            onScenarioChange={setTestScenario}
            onModeChange={changeMode}
            onSetpointChange={changeSetpoint}
            onReset={resetTrip}
          />
          <AlertsLogPanel logs={logs} />
          <OpsTutorialPanel />
        </main>
        <ContributorsFooter />
      </div>

      <BootOverlay visible={booting} />
      <FailureScreen active={failureLatched || state.failure_mode.toUpperCase() !== "NONE"} onShutdown={emergencyShutdown} />
    </>
  );
}
