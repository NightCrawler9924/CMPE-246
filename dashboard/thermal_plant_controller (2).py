"""
Thermal Plant Safety Controller
================================
CMPE 246 - Lab Group G4
UBC Okanagan

Hardware:
  - Raspberry Pi (main controller)
  - DS18B20 temperature sensor → GPIO4 (1-Wire)
  - Relay module (pump)        → GPIO17
  - LED Heating                → GPIO22
  - LED Holding                → GPIO23
  - LED Fault / Emergency      → GPIO24
  - LED System OK              → GPIO25
  - Arduino Nano (watchdog)    → UART /dev/ttyACM0

Wiring:
  DS18B20 VDD  → 3.3V
  DS18B20 GND  → GND
  DS18B20 DATA → GPIO4  (+ 5kΩ pull-up to 3.3V)

  Relay VCC    → Pi 5V
  Relay GND    → Pi GND
  Relay IN     → GPIO17
  Relay COM    → 5V
  Relay NO     → Pump + (or LED + for testing)

  LED anodes   → GPIO22 / 23 / 24 / 25
  Each LED     → 220Ω resistor → GND

  Arduino RX   → Pi GPIO14 (UART TX)
  Arduino GND  → Pi GND

How to run:
  python thermal_plant_controller.py

To test relay only (before sensor arrives):
  python thermal_plant_controller.py --relay-test
"""

import os
import glob
import time
import json
import argparse
import math

try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False

    class MockGPIO:
        BCM = "BCM"
        OUT = "OUT"
        HIGH = 1
        LOW = 0

        @staticmethod
        def setmode(mode):
            print(f"[MOCK GPIO] setmode({mode})")

        @staticmethod
        def setwarnings(flag):
            print(f"[MOCK GPIO] setwarnings({flag})")

        @staticmethod
        def setup(pin, mode):
            print(f"[MOCK GPIO] setup(pin={pin}, mode={mode})")

        @staticmethod
        def output(pin, value):
            pass

        @staticmethod
        def cleanup():
            print("[MOCK GPIO] cleanup()")

    GPIO = MockGPIO()

try:
    import serial
    SERIAL_AVAILABLE = True
except ImportError:
    SERIAL_AVAILABLE = False
    print("NOTE: pyserial not installed. Run: pip install pyserial")
    print("      Arduino heartbeat will be disabled.\n")

# ─────────────────────────────────────────
# CONFIGURATION — edit these values
# ─────────────────────────────────────────
RELAY_PIN       = 17      # Relay IN pin — controls pump (or LED for testing)
LED_HEATING     = 22      # LED: pump is ON / heating active
LED_HOLDING     = 23      # LED: at target temperature
LED_FAULT       = 24      # LED: fault or emergency
LED_OK          = 25      # LED: system running normally
BUZZER_PIN      = 12      # Buzzer: active during fault/emergency

TARGET_LOW      = 58.0    # Relay ON below this °C  (lower deadband)
TARGET_HIGH     = 60.0    # Relay OFF above this °C (upper deadband)
MAX_SAFE_TEMP   = 70.0    # Emergency cutoff °C
LOOP_DELAY      = 1.0     # Seconds between readings
FAIL_TEMP       = 60.0    # If continuously above this temp -> failure timer
FAIL_DURATION_S = 10.0    # Seconds above FAIL_TEMP before complete failure

RELAY_ACTIVE_LOW = False  # Set True if relay clicks backwards

ARDUINO_PORT    = "/dev/ttyACM0"   # Try /dev/ttyUSB0 if this fails
ARDUINO_BAUD    = 9600
HEARTBEAT_MSG   = b"HB\n"

STATE_FILE      = "/tmp/thermal_state.json"
MAX_HISTORY     = 300

# ─────────────────────────────────────────
# GLOBALS
# ─────────────────────────────────────────
start_time = time.time()
history    = []
current_mode = "AUTO"
mock_phase = 0.0


# ─────────────────────────────────────────
# SETUP
# ─────────────────────────────────────────
def setup():
    """Initialize GPIO pins. Always starts with relay OFF and OK LED ON."""
    if GPIO_AVAILABLE:
        os.system("modprobe w1-gpio")
        os.system("modprobe w1-therm")

    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)

    for pin in [RELAY_PIN, LED_HEATING, LED_HOLDING, LED_FAULT, LED_OK, BUZZER_PIN]:
        GPIO.setup(pin, GPIO.OUT)

    relay_off()
    buzzer_off()
    all_leds_off()
    set_led(LED_OK, True)

    print("GPIO initialized.")
    print("Relay OFF. System OK LED ON.")


def open_serial():
    """Connect to Arduino over UART. Returns None if unavailable."""
    if not SERIAL_AVAILABLE:
        return None
    try:
        ser = serial.Serial(ARDUINO_PORT, ARDUINO_BAUD, timeout=1)
        print(f"Arduino connected on {ARDUINO_PORT}")
        return ser
    except Exception as e:
        print(f"WARNING: Arduino not found on {ARDUINO_PORT} ({e})")
        print("         Heartbeat disabled. System will still run.")
        return None


# ─────────────────────────────────────────
# SENSOR
# ─────────────────────────────────────────
def find_sensor():
    """Find DS18B20 device file. Raises error with fix instructions if missing."""
    base_dir = "/sys/bus/w1/devices/"
    device_folders = glob.glob(base_dir + "28-*")
    if not device_folders:
        raise FileNotFoundError(
            "No DS18B20 sensor found.\n"
            "Fix: add 'dtoverlay=w1-gpio' to /boot/config.txt then reboot.\n"
            "Check: wiring and 5kOhm pull-up resistor between DATA and 3.3V."
        )
    sensor_path = device_folders[0] + "/w1_slave"
    print(f"Sensor found: {sensor_path}")
    return sensor_path


def read_temperature(sensor_file):
    """
    Read temperature from DS18B20.
    Returns float in degrees C, or None if reading fails.
    """
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


def read_mock_temperature():
    """
    Generates a software-only temperature curve for local testing.
    Includes one startup window above 60C so the failure logic can be observed.
    """
    global mock_phase
    elapsed = time.time() - start_time
    # Demo window (one-time after startup) to let UI show red-screen failure behavior.
    if 8.0 <= elapsed <= 22.0:
        return 61.2 + (math.sin(elapsed * 1.5) * 0.35)
    mock_phase += 0.23
    return 59.0 + (math.sin(mock_phase) * 2.8)


# ─────────────────────────────────────────
# RELAY
# ─────────────────────────────────────────
def relay_on():
    """Activate relay — turns pump (or test LED) ON."""
    GPIO.output(RELAY_PIN, GPIO.LOW if RELAY_ACTIVE_LOW else GPIO.HIGH)

def relay_off():
    """Deactivate relay — turns pump (or test LED) OFF."""
    GPIO.output(RELAY_PIN, GPIO.HIGH if RELAY_ACTIVE_LOW else GPIO.LOW)


# ─────────────────────────────────────────
# BUZZER
# ─────────────────────────────────────────
def buzzer_on():
    GPIO.output(BUZZER_PIN, GPIO.HIGH)


def buzzer_off():
    GPIO.output(BUZZER_PIN, GPIO.LOW)


# ─────────────────────────────────────────
# LEDs
# ─────────────────────────────────────────
def set_led(pin, state):
    GPIO.output(pin, GPIO.HIGH if state else GPIO.LOW)

def all_leds_off():
    for pin in [LED_HEATING, LED_HOLDING, LED_FAULT, LED_OK]:
        GPIO.output(pin, GPIO.LOW)

def set_status_leds(status):
    """
    LED meanings:
      HEATING   -> Heating LED + OK LED on  (relay ON, below target)
      HOLDING   -> Holding LED + OK LED on  (at target, stable)
      FAULT     -> Fault LED only           (sensor failure)
      EMERGENCY -> Fault LED only           (over-temperature)
      SYSTEM_FAILURE -> Fault LED only      (latched complete failure)
    """
    all_leds_off()
    if status == "HEATING":
        set_led(LED_HEATING, True)
        set_led(LED_OK, True)
    elif status == "HOLDING":
        set_led(LED_HOLDING, True)
        set_led(LED_OK, True)
    elif status in ("FAULT", "EMERGENCY", "SYSTEM_FAILURE"):
        set_led(LED_FAULT, True)
    else:
        set_led(LED_OK, True)


# ─────────────────────────────────────────
# HEARTBEAT
# ─────────────────────────────────────────
def send_heartbeat(ser):
    """
    Send HB to Arduino every loop.
    If Pi freezes, Arduino stops receiving and trips its safety relay.
    """
    if ser:
        try:
            ser.write(HEARTBEAT_MSG)
        except Exception as e:
            print(f"WARNING: Heartbeat failed: {e}")


# ─────────────────────────────────────────
# STATE LOGGING
# ─────────────────────────────────────────
def write_state(temp, relay_state, status):
    """Write current state to JSON file for dashboard teammates."""
    relay_on_bool = relay_state == "ON"
    failure_mode = "NONE"
    if status == "FAULT":
        failure_mode = "FAILURE"
    elif status == "EMERGENCY":
        failure_mode = "EMERGENCY"
    elif status == "SYSTEM_FAILURE":
        failure_mode = "COMPLETE_FAILURE"

    state = {
        # Keys consumed by the dashboard backend/frontend
        "current_temperature": round(temp, 2) if temp is not None else None,
        "setpoint": TARGET_HIGH,
        "mode": current_mode,
        "trip_status": status in ("FAULT", "EMERGENCY", "SYSTEM_FAILURE"),
        "heater_on": relay_on_bool,
        "pump_on": relay_on_bool,
        "relay_on": relay_on_bool,
        "buzzer_on": status in ("FAULT", "EMERGENCY", "SYSTEM_FAILURE"),
        "led_heating": status == "HEATING",
        "led_holding": status == "HOLDING",
        "led_fault": status in ("FAULT", "EMERGENCY", "SYSTEM_FAILURE"),
        "led_ok": status in ("HEATING", "HOLDING", "IDLE"),
        "failure_mode": failure_mode,
        # Legacy/debug keys kept for compatibility
        "temp": round(temp, 2) if temp is not None else None,
        "relay": relay_state,
        "status": status,
        "target_low": TARGET_LOW,
        "target_high": TARGET_HIGH,
        "max_safe": MAX_SAFE_TEMP,
        "history": history[-MAX_HISTORY:],
        "uptime": round(time.time() - start_time),
    }
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f)
    except Exception as e:
        print(f"WARNING: Could not write state: {e}")


# ─────────────────────────────────────────
# CONTROL LOOP
# ─────────────────────────────────────────
def control_loop(sensor_file, ser, mock_mode=False):
    """
    Runs forever. Every second:
      1. Read temperature
      2. Send heartbeat to Arduino
      3. Decide relay ON or OFF
      4. Update LEDs
      5. Log state to file
    """
    relay_state = "OFF"
    above_fail_temp_since = None
    failure_latched = False

    while True:
        temp = read_mock_temperature() if mock_mode else read_temperature(sensor_file)
        elapsed = round(time.time() - start_time, 1)

        if temp is not None:
            history.append({"time": elapsed, "temp": round(temp, 2)})

        send_heartbeat(ser)

        if failure_latched:
            temp_text = f"{temp:.2f}" if temp is not None else "N/A"
            relay_off()
            buzzer_on()
            relay_state = "OFF"
            set_status_leds("SYSTEM_FAILURE")
            print(f"[{temp_text} C] COMPLETE FAILURE LATCHED. Manual reset required.")
            write_state(temp, relay_state, "SYSTEM_FAILURE")
            time.sleep(LOOP_DELAY)
            continue

        # Sensor failure → everything off
        if temp is None:
            print("FAULT: Sensor failed. Relay OFF (fail-safe).")
            relay_off()
            buzzer_on()
            relay_state = "OFF"
            set_status_leds("FAULT")
            write_state(temp, relay_state, "FAULT")
            above_fail_temp_since = None

        # Over-temperature emergency
        elif temp >= MAX_SAFE_TEMP:
            print(f"[{temp:.2f} C] EMERGENCY: {MAX_SAFE_TEMP}C limit hit. Relay OFF.")
            relay_off()
            buzzer_on()
            relay_state = "OFF"
            set_status_leds("EMERGENCY")
            write_state(temp, relay_state, "EMERGENCY")
            above_fail_temp_since = None

        # Sustained over-limit failure logic (new requirement)
        elif temp > FAIL_TEMP:
            if above_fail_temp_since is None:
                above_fail_temp_since = time.time()
                print(f"[{temp:.2f} C] WARNING: Above {FAIL_TEMP} C. Failure timer started.")

            over_time = time.time() - above_fail_temp_since
            if over_time >= FAIL_DURATION_S:
                print(
                    f"[{temp:.2f} C] COMPLETE FAILURE: above {FAIL_TEMP}C for "
                    f"{FAIL_DURATION_S:.0f}s. Relay OFF + buzzer ON."
                )
                failure_latched = True
                relay_off()
                buzzer_on()
                relay_state = "OFF"
                set_status_leds("SYSTEM_FAILURE")
                write_state(temp, relay_state, "SYSTEM_FAILURE")
            else:
                if relay_state != "OFF":
                    print(f"[{temp:.2f} C] Above {TARGET_HIGH} C -> Relay OFF")
                    relay_state = "OFF"
                relay_off()
                buzzer_off()
                set_status_leds("HOLDING")
                print(
                    f"[{temp:.2f} C] Above 60C for {over_time:.1f}s "
                    f"(failure at {FAIL_DURATION_S:.0f}s)."
                )
                write_state(temp, relay_state, "HOLDING")

        # Below lower threshold → relay ON
        elif temp < TARGET_LOW:
            above_fail_temp_since = None
            if relay_state != "ON":
                print(f"[{temp:.2f} C] Below {TARGET_LOW} C -> Relay ON")
                relay_state = "ON"
            relay_on()
            buzzer_off()
            set_status_leds("HEATING")
            write_state(temp, relay_state, "HEATING")

        # Within deadband → hold current state
        else:
            above_fail_temp_since = None
            print(f"[{temp:.2f} C] Within band ({TARGET_LOW}-{TARGET_HIGH} C). Relay {relay_state}.")
            buzzer_off()
            set_status_leds("HOLDING")
            write_state(temp, relay_state, "HOLDING")

        time.sleep(LOOP_DELAY)


# ─────────────────────────────────────────
# RELAY BLINK TEST
# ─────────────────────────────────────────
def relay_test():
    """
    Stage 1 test — no sensor needed.
    Blinks relay ON/OFF every 2 seconds.
    Watch for LED blink and relay click sound.
    If LED is on when it should be off, set RELAY_ACTIVE_LOW = True
    """
    print("=== Relay test mode ===")
    print("Relay clicks ON and OFF every 2 seconds.")
    print("Watch for LED blink and listen for relay click.")
    print("Press Ctrl+C to stop.\n")

    try:
        while True:
            relay_on()
            set_led(LED_OK, True)
            print("Relay ON  -> LED should be ON")
            time.sleep(2)

            relay_off()
            set_led(LED_OK, False)
            print("Relay OFF -> LED should be OFF")
            time.sleep(2)

    except KeyboardInterrupt:
        print("\nTest stopped.")


# ─────────────────────────────────────────
# CLEANUP
# ─────────────────────────────────────────
def cleanup():
    """Always runs on exit — relay off, all LEDs off, GPIO released."""
    print("\nShutting down. Relay OFF. All LEDs OFF.")
    relay_off()
    buzzer_off()
    all_leds_off()
    GPIO.cleanup()


# ─────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Thermal Plant Controller")
    parser.add_argument("--relay-test", action="store_true",
                        help="Run relay blink test only (no sensor needed)")
    parser.add_argument("--mock-sensor", action="store_true",
                        help="Run without DS18B20 using a synthetic temperature curve")
    args = parser.parse_args()

    print("=== Thermal Plant Controller ===")
    print("CMPE 246 - Lab Group G4, UBC Okanagan\n")

    ser = None
    try:
        setup()

        if args.relay_test:
            relay_test()

        else:
            ser = open_serial()
            sensor_file = None if args.mock_sensor else find_sensor()
            print(f"\nTarget range:  {TARGET_LOW} - {TARGET_HIGH} C")
            print(f"Safety cutoff: {MAX_SAFE_TEMP} C")
            if args.mock_sensor:
                print("Mock sensor enabled. Running without physical DS18B20.")
            print("Starting control loop... (Ctrl+C to stop)\n")
            control_loop(sensor_file, ser, mock_mode=args.mock_sensor)

    except FileNotFoundError as e:
        print(f"\nSETUP ERROR: {e}")

    except KeyboardInterrupt:
        print("\nStopped by user.")

    finally:
        if ser:
            ser.close()
        cleanup()
