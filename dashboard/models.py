from pydantic import BaseModel
from typing import Literal


class ControlState(BaseModel):
    current_temperature: float
    setpoint: float
    mode: Literal["OFF", "MANUAL", "AUTO"]
    trip_status: bool
    heater_on: bool
    pump_on: bool
    relay_on: bool = False
    buzzer_on: bool = False
    led_heating: bool = False
    led_holding: bool = False
    led_fault: bool = False
    led_ok: bool = False
    failure_mode: str = "NONE"


class SetpointUpdate(BaseModel):
    setpoint: float


class ModeUpdate(BaseModel):
    mode: Literal["OFF", "MANUAL", "AUTO"]
