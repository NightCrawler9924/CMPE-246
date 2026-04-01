import { create } from "zustand";
import { backendApi } from "../services/api";
import type { LogEntry, PlantMode, PlantState, SystemLevel, TelemetryPoint, TestScenario } from "../types";

const MAX_POINTS = 180;
const MAX_LOGS = 220;
const POLL_MS = 900;

const baseState: PlantState = {
  current_temperature: 24.5,
  setpoint: 60,
  mode: "OFF",
  trip_status: false,
  heater_on: false,
  pump_on: true,
  relay_on: false,
  buzzer_on: false,
  led_heating: false,
  led_holding: false,
  led_fault: false,
  led_ok: true,
  failure_mode: "NONE",
};

interface ReactorStore {
  state: PlantState;
  stream: TelemetryPoint[];
  logs: LogEntry[];
  simulationMode: boolean;
  testScenario: TestScenario;
  connected: boolean;
  booting: boolean;
  failureLatched: boolean;
  risingAbove60Ms: number;
  systemLevel: SystemLevel;
  intervalId: number | null;
  prevTemp: number | null;
  riseStart: number | null;
  start: () => void;
  stop: () => void;
  poll: () => Promise<void>;
  setSimulationMode: (enabled: boolean) => void;
  setTestScenario: (scenario: TestScenario) => void;
  changeSetpoint: (value: number) => Promise<void>;
  changeMode: (mode: PlantMode) => Promise<void>;
  resetTrip: () => Promise<void>;
  emergencyShutdown: () => Promise<void>;
}

function nowTime(): string {
  return new Date().toLocaleTimeString();
}

function makeLog(level: LogEntry["level"], message: string): LogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: nowTime(),
    level,
    message,
  };
}

function simulateTemperature(baseTemp: number, scenario: TestScenario, tMs: number): number {
  switch (scenario) {
    case "NORMAL_OPERATION":
      return 55.5 + Math.sin(tMs / 1000) * 1.1;
    case "GRADUAL_TEMPERATURE_RISE":
      return 54 + ((tMs / 1000) % 18) * 0.62 + Math.sin(tMs / 550) * 0.22;
    case "RAPID_SPIKE":
      return 52 + Math.abs(Math.sin(tMs / 400)) * 14;
    case "CRITICAL_OVERHEAT":
      return 63.4 + Math.sin(tMs / 420) * 0.35;
    case "OSCILLATION_MODE":
      return 58 + Math.sin(tMs / 750) * 4.7;
    case "SENSOR_FAILURE":
      return baseTemp;
    default:
      return baseTemp;
  }
}

export const useReactorStore = create<ReactorStore>((set, get) => ({
  state: baseState,
  stream: [],
  logs: [makeLog("INFO", "Control interface initialized.")],
  simulationMode: false,
  testScenario: "NORMAL_OPERATION",
  connected: false,
  booting: true,
  failureLatched: false,
  risingAbove60Ms: 0,
  systemLevel: "ONLINE",
  intervalId: null,
  prevTemp: null,
  riseStart: null,

  start: () => {
    if (get().intervalId !== null) return;
    void get().poll();
    const id = window.setInterval(() => {
      void get().poll();
    }, POLL_MS);
    set({ intervalId: id });
    window.setTimeout(() => set({ booting: false }), 2200);
  },

  stop: () => {
    const id = get().intervalId;
    if (id !== null) {
      window.clearInterval(id);
      set({ intervalId: null });
    }
  },

  poll: async () => {
    const tMs = Date.now();
    try {
      const remote = await backendApi.readState();
      const { simulationMode, testScenario, prevTemp, riseStart, failureLatched } = get();

      const scenario = simulationMode ? testScenario : null;
      const sourceTemp = scenario ? simulateTemperature(remote.current_temperature, scenario, tMs) : remote.current_temperature;
      const effectiveTemp = Number(sourceTemp.toFixed(2));

      const effective: PlantState = {
        ...remote,
        current_temperature: effectiveTemp,
        trip_status: scenario === "SENSOR_FAILURE" ? true : remote.trip_status,
        failure_mode:
          scenario === "SENSOR_FAILURE"
            ? "FAILURE"
            : failureLatched
              ? "SYSTEM_FAILURE"
              : remote.failure_mode,
      };

      let nextRiseStart = riseStart;
      let nextRisingMs = get().risingAbove60Ms;
      let nextFailureLatched = failureLatched;
      let nextLevel: SystemLevel = "ONLINE";
      let maybeLog: LogEntry | null = null;

      if (effective.mode === "OFF") {
        nextRiseStart = null;
        nextRisingMs = 0;
        nextFailureLatched = false;
      } else if (effectiveTemp > 60 && prevTemp !== null && effectiveTemp > prevTemp) {
        if (nextRiseStart === null) nextRiseStart = tMs;
        nextRisingMs = tMs - nextRiseStart;
        if (nextRisingMs >= 10_000) {
          nextFailureLatched = true;
        }
      } else {
        nextRiseStart = null;
        nextRisingMs = 0;
      }

      if (nextFailureLatched || effective.failure_mode.toUpperCase() !== "NONE") {
        nextLevel = "CRITICAL";
      } else if (effectiveTemp >= 56 || effective.trip_status) {
        nextLevel = "WARNING";
      }

      if (nextFailureLatched && !failureLatched) {
        maybeLog = makeLog("CRIT", "SYSTEM FAILURE: Temperature breach sustained above 60C for 10s.");
      }

      const tempLog =
        Math.floor(tMs / 5000) !== Math.floor((tMs - POLL_MS) / 5000)
          ? makeLog(
              "INFO",
              `Temp ${effectiveTemp.toFixed(2)}C | Mode ${effective.mode} | Relay ${effective.relay_on ? "ON" : "OFF"} | Source ${scenario ?? "BACKEND_LIVE"}`,
            )
          : null;

      set((s) => ({
        state: effective,
        connected: true,
        prevTemp: effectiveTemp,
        riseStart: nextRiseStart,
        risingAbove60Ms: nextRisingMs,
        failureLatched: nextFailureLatched,
        systemLevel: nextLevel,
        stream: [...s.stream, { timestamp: nowTime(), temp: effectiveTemp }].slice(-MAX_POINTS),
        logs: [...s.logs, ...(tempLog ? [tempLog] : []), ...(maybeLog ? [maybeLog] : [])].slice(-MAX_LOGS),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Backend unavailable";
      set((s) => ({
        connected: false,
        systemLevel: "WARNING",
        logs: [...s.logs, makeLog("WARN", `Data stream interruption: ${message}`)].slice(-MAX_LOGS),
      }));
    }
  },

  setSimulationMode: (enabled) => {
    set((s) => ({
      simulationMode: enabled,
      logs: [...s.logs, makeLog("INFO", `Simulation mode ${enabled ? "enabled" : "disabled"}.`)].slice(-MAX_LOGS),
    }));
  },

  setTestScenario: (scenario) => {
    set((s) => ({
      testScenario: scenario,
      logs: [...s.logs, makeLog("INFO", `Test scenario: ${scenario}.`)].slice(-MAX_LOGS),
    }));
  },

  changeSetpoint: async (value) => {
    const result = await backendApi.updateSetpoint(value);
    set((s) => ({
      logs: [...s.logs, makeLog("INFO", result.message)].slice(-MAX_LOGS),
    }));
    await get().poll();
  },

  changeMode: async (mode) => {
    const result = await backendApi.updateMode(mode);
    set((s) => ({
      logs: [...s.logs, makeLog("INFO", result.message)].slice(-MAX_LOGS),
    }));
    await get().poll();
  },

  resetTrip: async () => {
    const result = await backendApi.resetTrip();
    set((s) => ({
      failureLatched: false,
      risingAbove60Ms: 0,
      riseStart: null,
      logs: [...s.logs, makeLog("INFO", result.message)].slice(-MAX_LOGS),
    }));
    await get().poll();
  },

  emergencyShutdown: async () => {
    await backendApi.updateMode("OFF");
    set((s) => ({
      failureLatched: false,
      risingAbove60Ms: 0,
      riseStart: null,
      logs: [...s.logs, makeLog("CRIT", "Emergency shutdown executed. Mode forced to OFF.")].slice(-MAX_LOGS),
    }));
    await get().poll();
  },
}));
