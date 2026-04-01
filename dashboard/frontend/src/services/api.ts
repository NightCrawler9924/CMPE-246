import type { PlantMode, PlantState } from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  const payload = (await response.json()) as T & { detail?: string };
  if (!response.ok) {
    throw new Error(payload.detail || "Request failed");
  }
  return payload as T;
}

export const backendApi = {
  readState: (): Promise<PlantState> => request<PlantState>("/state"),
  updateSetpoint: (setpoint: number): Promise<{ message: string; setpoint: number }> =>
    request("/setpoint", {
      method: "POST",
      body: JSON.stringify({ setpoint }),
    }),
  updateMode: (mode: PlantMode): Promise<{ message: string; mode: PlantMode }> =>
    request("/mode", {
      method: "POST",
      body: JSON.stringify({ mode }),
    }),
  resetTrip: (): Promise<{ message: string }> =>
    request("/reset", {
      method: "POST",
    }),
};
