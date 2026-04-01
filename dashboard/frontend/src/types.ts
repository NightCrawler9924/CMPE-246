export type PlantMode = "OFF" | "MANUAL" | "AUTO";

export interface PlantState {
  current_temperature: number;
  setpoint: number;
  mode: PlantMode;
  trip_status: boolean;
  heater_on: boolean;
  pump_on: boolean;
  relay_on: boolean;
  buzzer_on: boolean;
  led_heating: boolean;
  led_holding: boolean;
  led_fault: boolean;
  led_ok: boolean;
  failure_mode: string;
}

export type SystemLevel = "ONLINE" | "WARNING" | "CRITICAL";

export type TestScenario =
  | "NORMAL_OPERATION"
  | "GRADUAL_TEMPERATURE_RISE"
  | "RAPID_SPIKE"
  | "CRITICAL_OVERHEAT"
  | "SENSOR_FAILURE"
  | "OSCILLATION_MODE";

export interface TelemetryPoint {
  timestamp: string;
  temp: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "CRIT";
  message: string;
}
