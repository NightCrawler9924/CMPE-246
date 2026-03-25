"""
Thermal Plant Safety Controller
================================
Hardware:
  - Raspberry Pi (main controller)
  - DS18B20 temperature sensor → GPIO4 (1-Wire)
  - Relay module (heater)      → GPIO17
  - Pump                       → GPIO27
  - LED Heating                → GPIO22
  - LED Holding                → GPIO23
  - LED Fault / Emergency      → GPIO24
  - LED System OK              → GPIO25
  - Arduino Nano (watchdog)    → UART /dev/ttyACM0

Wiring Summary:
  DS18B20 VDD  → 3.3V
  DS18B20 GND  → GND
  DS18B20 DATA → GPIO4  (+ 4.7kΩ–5kΩ pull-up to 3.3V)

  Relay VCC    → 5V  |  Relay GND → GND  |  Relay IN → GPIO17
  Pump VCC     → 5V  |  Pump GND  → GND  |  Pump IN  → GPIO27

  LED anodes   → GPIO22 / 23 / 24 / 25  (each with 220Ω resistor to GND)

  Arduino RX   → Pi GPIO14 (UART TX)
  Arduino GND  → Pi GND
"""

import os
import glob
import time
import json
import serial
import RPi.GPIO as GPIO

# ─────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────
RELAY_PIN       = 17      # Heater relay
PUMP_PIN        = 27      # Water pump
LED_HEATING     = 22      # Orange/Red LED — heater is ON
LED_HOLDING     = 23      # Green LED     — at target temp
LED_FAULT       = 24      # Red LED       — fault or emergency
LED_OK          = 25      # Blue LED      — system running normally

TARGET_LOW      = 58.0    # Heater ON below this °C
TARGET_HIGH     = 60.0    # Heater OFF above this °C
PUMP_ON_TEMP    = 55.0    # Pump starts cooling above this °C
MAX_SAFE_TEMP   = 70.0    # Emergency cutoff °C
LOOP_DELAY      = 1.0     # Seconds between readings

RELAY_ACTIVE_LOW = False  # Flip to True if relay clicks backwards

ARDUINO_PORT    = "/dev/ttyACM0"   # Try /dev/ttyUSB0 if this fails
ARDUINO_BAUD    = 9600
HEARTBEAT_MSG   = b"HB\n"          # What Pi sends to Arduino each loop

STATE_FILE      = "/tmp/thermal_state.json"
MAX_HISTORY     = 300
start_time      = time.time()
history         = []


# ─────────────────────────────────────────
# SETUP
# ─────────────────────────────────────────
def setup():
    os.system("modprobe w1-gpio")
    os.system("modprobe w1-therm")

    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)

    for pin in [RELAY_PIN, PUMP_PIN, LED_HEATING, LED_HOLDING, LED_FAULT, LED_OK]:
        GPIO.setup(pin, GPIO.OUT)

    # Safe defaults
    heater_off()
    pump_off()
    all_leds_off()
    set_led(LED_OK, True)   # Blue ON = system running

    print("System initialized. Heater OFF. Pump OFF.")


def open_serial():
    """Open UART connection to Arduino. Returns None if not available."""
    try:
        ser = serial.Serial(ARDUINO_PORT, ARDUINO_BAUD, timeout=1)
        print(f"Arduino connected on {ARDUINO_PORT}")
        return ser
    except Exception as e:
        print(f"WARNING: Arduino not connected ({e}). Heartbeat disabled.")
        return None


# ─────────────────────────────────────────
# SENSOR
# ─────────────────────────────────────────
def find_sensor():
    base_dir = "/sys/bus/w1/devices/"
    device_folders = glob.glob(base_dir + "28-*")
    if not device_folders:
        raise FileNotFoundError(
            "No DS18B20 sensor found.\n"
            "Check: wiring, pull-up resistor, and that 1-Wire is enabled.\n"
            "Run: sudo nano /boot/config.txt -> add dtoverlay=w1-gpio -> reboot"
        )
    return device_folders[0] + "/w1_slave"


def read_temperature(sensor_file):
    try:
        with open(sensor_file, "r") as f:
            lines = f.readlines()
        if "YES" not in lines[0]:
            print("WARNING: Sensor returned invalid reading.")
            return None
        temp_string = lines[1].split("t=")[-1].strip()
        return float(temp_string) / 1000.0
    except Exception as e:
        print(f"ERROR reading sensor: {e}")
        return None


# ─────────────────────────────────────────
# HEATER
# ─────────────────────────────────────────
def heater_on():
    GPIO.output(RELAY_PIN, GPIO.LOW if RELAY_ACTIVE_LOW else GPIO.HIGH)

def heater_off():
    GPIO.output(RELAY_PIN, GPIO.HIGH if RELAY_ACTIVE_LOW else GPIO.LOW)


# ─────────────────────────────────────────
# PUMP
# ─────────────────────────────────────────
def pump_on():
    GPIO.output(PUMP_PIN, GPIO.HIGH)

def pump_off():
    GPIO.output(PUMP_PIN, GPIO.LOW)


# ─────────────────────────────────────────
# LEDs
# ─────────────────────────────────────────
def set_led(pin, state):
    GPIO.output(pin, GPIO.HIGH if state else GPIO.LOW)

def all_leds_off():
    for pin in [LED_HEATING, LED_HOLDING, LED_FAULT, LED_OK]:
        GPIO.output(pin, GPIO.LOW)

def set_status_leds(status):
    """Set LEDs based on current system status."""
    all_leds_off()
    if status == "HEATING":
        set_led(LED_HEATING, True)
        set_led(LED_OK, True)
    elif status == "HOLDING":
        set_led(LED_HOLDING, True)
        set_led(LED_OK, True)
    elif status in ("FAULT", "EMERGENCY"):
        set_led(LED_FAULT, True)
    else:
        set_led(LED_OK, True)


# ─────────────────────────────────────────
# HEARTBEAT
# ─────────────────────────────────────────
def send_heartbeat(ser):
    """Send heartbeat to Arduino every loop. If Pi freezes, Arduino trips its relay."""
    if ser:
        try:
            ser.write(HEARTBEAT_MSG)
        except Exception as e:
            print(f"WARNING: Heartbeat send failed: {e}")


# ─────────────────────────────────────────
# STATE LOGGING
# ─────────────────────────────────────────
def write_state(temp, heater_state, pump_state, status):
    state = {
        "temp":         round(temp, 2) if temp is not None else None,
        "heater":       heater_state,
        "pump":         pump_state,
        "status":       status,
        "target_low":   TARGET_LOW,
        "target_high":  TARGET_HIGH,
        "pump_on_temp": PUMP_ON_TEMP,
        "max_safe":     MAX_SAFE_TEMP,
        "history":      history[-MAX_HISTORY:],
        "uptime":       round(time.time() - start_time),
    }
    try:
        with open(STATE_FILE, "w") as f:
            json.dump(state, f)
    except Exception as e:
        print(f"WARNING: Could not write state file: {e}")


# ─────────────────────────────────────────
# CONTROL LOOP
# ─────────────────────────────────────────
def control_loop(sensor_file, ser):
    heater_state = "OFF"
    pump_state   = "OFF"

    while True:
        temp    = read_temperature(sensor_file)
        elapsed = round(time.time() - start_time, 1)

        if temp is not None:
            history.append({"time": elapsed, "temp": round(temp, 2)})

        # Send heartbeat to Arduino every loop
        send_heartbeat(ser)

        # Sensor failure → fail safe
        if temp is None:
            print("FAULT: Sensor read failed. Heater OFF, Pump OFF.")
            heater_off()
            pump_off()
            heater_state = "OFF"
            pump_state   = "OFF"
            set_status_leds("FAULT")
            write_state(temp, heater_state, pump_state, "FAULT")

        # Over-temperature emergency
        elif temp >= MAX_SAFE_TEMP:
            print(f"[{temp:.2f} C] EMERGENCY: Over-temperature! All OFF.")
            heater_off()
            pump_on()   # Keep pump running to cool down
            heater_state = "OFF"
            pump_state   = "ON"
            set_status_leds("EMERGENCY")
            write_state(temp, heater_state, pump_state, "EMERGENCY")

        # Below target → heat, no pump
        elif temp < TARGET_LOW:
            if heater_state != "ON":
                print(f"[{temp:.2f} C] Below {TARGET_LOW} C -> Heater ON")
                heater_state = "ON"
            heater_on()
            pump_off()
            pump_state = "OFF"
            set_status_leds("HEATING")
            write_state(temp, heater_state, pump_state, "HEATING")

        # Above target → stop heating, run pump if warm
        elif temp > TARGET_HIGH:
            if heater_state != "OFF":
                print(f"[{temp:.2f} C] Above {TARGET_HIGH} C -> Heater OFF")
                heater_state = "OFF"
            heater_off()
            if temp >= PUMP_ON_TEMP:
                pump_on()
                pump_state = "ON"
            else:
                pump_off()
                pump_state = "OFF"
            set_status_leds("HOLDING")
            write_state(temp, heater_state, pump_state, "HOLDING")

        # Within band → hold state
        else:
            print(f"[{temp:.2f} C] Within band. Heater {heater_state} | Pump {pump_state}.")
            set_status_leds("HOLDING")
            write_state(temp, heater_state, pump_state, "HOLDING")

        time.sleep(LOOP_DELAY)


# ─────────────────────────────────────────
# CLEANUP
# ─────────────────────────────────────────
def cleanup():
    print("\nShutting down. Heater OFF. Pump OFF.")
    heater_off()
    pump_off()
    all_leds_off()
    GPIO.cleanup()


# ─────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────
if __name__ == "__main__":
    print("=== Thermal Plant Controller ===")
    ser = None
    try:
        setup()
        ser = open_serial()
        sensor_file = find_sensor()
        print(f"Sensor found:  {sensor_file}")
        print(f"Target range:  {TARGET_LOW} - {TARGET_HIGH} C")
        print(f"Pump on above: {PUMP_ON_TEMP} C")
        print(f"Safety cutoff: {MAX_SAFE_TEMP} C")
        print("Starting control loop... (Ctrl+C to stop)\n")
        control_loop(sensor_file, ser)
    except FileNotFoundError as e:
        print(f"SETUP ERROR: {e}")
    except KeyboardInterrupt:
        print("Stopped by user.")
    finally:
        if ser:
            ser.close()
        cleanup()
