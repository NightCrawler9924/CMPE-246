from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import ControlState, SetpointUpdate, ModeUpdate
from state import state

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Thermal Control Backend Running"}


@app.get("/state", response_model=ControlState)
def get_state():
    return state


@app.get("/setpoint")
def get_setpoint():
    return {"setpoint": state["setpoint"]}


@app.post("/setpoint")
def update_setpoint(data: SetpointUpdate):
    if state["trip_status"]:
        raise HTTPException(status_code=400, detail="Cannot change setpoint while system is tripped.")

    if data.setpoint < 10 or data.setpoint > 80:
        raise HTTPException(status_code=400, detail="Setpoint must be between 10 and 80.")

    state["setpoint"] = data.setpoint
    return {"message": "Setpoint updated", "setpoint": state["setpoint"]}


@app.get("/mode")
def get_mode():
    return {"mode": state["mode"]}


@app.post("/mode")
def update_mode(data: ModeUpdate):
    if state["trip_status"] and data.mode != "OFF":
        raise HTTPException(status_code=400, detail="System is tripped. Only OFF mode is allowed.")

    state["mode"] = data.mode
    return {"message": "Mode updated", "mode": state["mode"]}

@app.post("/reset")
def reset_trip():
    state["trip_status"] = False
    state["heater_on"] = False
    state["pump_on"] = True
    state["mode"] = "OFF"
    return {"message": "System reset to safe state"}