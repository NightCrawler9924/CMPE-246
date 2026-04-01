from pydantic import BaseModel
from typing import Literal


class ControlState(BaseModel):
    current_temperature: float
    setpoint: float
    mode: Literal["OFF", "MANUAL", "AUTO"]
    trip_status: bool
    heater_on: bool
    pump_on: bool


class SetpointUpdate(BaseModel):
    setpoint: float


class ModeUpdate(BaseModel):
    mode: Literal["OFF", "MANUAL", "AUTO"]