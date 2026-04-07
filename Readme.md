# ThermoGuard -- Safety-Critical Thermal Control System

An autonomous cooling and safety monitoring system built around real-time temperature tracking, automated cooling activation, and fail-safe shutdown logic.

Built as part of **Reactor Sentinel**, a team project developed for CMPE 246 at the University of British Columbia.

---

## What it does

ThermoGuard monitors temperature in real time, activates a cooling pump automatically when thresholds are exceeded, and escalates to a critical safety shutdown if temperatures remain unsafe.

Every state transition is defined. There is no undefined behavior for edge cases.

The system operates across three layers:

- **Hardware layer:** Raspberry Pi and Arduino handle sensor polling, cooling pump control, and safety state management
- **Backend layer:** Python backend receives hardware data, processes safety logic, and exposes a real-time data API
- **Frontend layer:** A live web dashboard visualizes temperature readings, system status, and safety states as they change

---

## System states

| State | Description |
|---|---|
| Normal | Temperature within bounds, cooling inactive |
| Cooling Active | Temperature exceeded threshold, pump activated automatically |
| Critical Shutdown | Temperature remained unsafe, full system shutdown initiated |

---

## Architecture

```
Hardware (Raspberry Pi + Arduino)
        |
        | Serial / GPIO
        |
Python Backend (safety logic, data processing, API)
        |
        | HTTP / WebSocket
        |
Web Dashboard (real-time temperature, status, safety state)
```

---

## My contributions

- Connected physical hardware layer to the Python backend
- Built the backend-to-frontend data pipeline for real-time communication
- Implemented live dashboard displaying temperature readings, system status, and safety states
- Contributed to web interface design and overall system integration
- Responsible for end-to-end system functioning across all three layers

---

## Tech stack

| Layer | Technologies |
|---|---|
| Hardware | Raspberry Pi, Arduino, Python |
| Backend | Python |
| Frontend | HTML, CSS, JavaScript, TypeScript |
| Communication | Real-time data pipeline, HTTP API |

---

## What we learned

The system went through multiple failure modes during development.

Sensors failed mid-operation. Communication between layers broke unexpectedly. Safety shutdowns triggered when nothing was wrong. In some cases the system refused to shut down when it should have.

Debugging across the full stack from hardware through to the browser is where the real engineering happened. This project shifted the approach from solving assignments to building systems that behave correctly in the real world, including when things go wrong.

---

## Status

Currently evolving toward full hardware integration, system validation, and reliability testing as a proper safety-critical control architecture.

Next steps:
- System validation under stress conditions
- Reliability testing across extended operation periods
- Full hardware integration with production-grade components
- Safety state verification testing

---

## Team

Reactor Sentinel -- University of British Columbia, CMPE 246

---

## License

MIT
