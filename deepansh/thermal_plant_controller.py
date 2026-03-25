"""
Thermal Plant Safety Controller
================================
Hardware:
  - Raspberry Pi (any model with GPIO)
  - DS18B20 temperature sensor on GPIO4 (1-Wire)
  - Relay module on GPIO17
  - 4.7kΩ pull-up resistor between DATA and 3.3V

Wiring Summary:
  DS18B20 VDD  → Pi 3.3V
  DS18B20 GND  → Pi GND
  DS18B20 DATA → Pi GPIO4  (+ 4.7kΩ resistor to 3.3V)

  Relay VCC    → Pi 5V
  Relay GND    → Pi GND
  Relay IN     → Pi GPIO17
"""

import os
import glob
import time
import RPi.GPIO as GPIO

# ─────────────────────────────────────────
# CONFIGURATION  (edit these values)
# ─────────────────────────────────────────
RELAY_PIN      = 17       # GPIO pin connected to relay module
TARGET_LOW     = 58.0     # Turn heater ON  below this °C
TARGET_HIGH    = 60.0     # Turn heater OFF above this °C
MAX_SAFE_TEMP  = 70.0     # Emergency cutoff °C
LOOP_DELAY     = 1.0      # Seconds between readings

# Set to True if your relay module is ACTIVE LOW
# (LOW = heater ON, HIGH = heater OFF)
# Test this first — see Stage 1 below
RELAY_ACTIVE_LOW = False

# ─────────────────────────────────────────
# SETUP
# ─────────────────────────────────────────
def setup():
    """Initialize GPIO and 1-Wire sensor."""
    # Enable 1-Wire kernel module
    os.system("modprobe w1-gpio")
    os.system("modprobe w1-therm")

    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    GPIO.setup(RELAY_PIN, GPIO.OUT)

    heater_off()  # Always start with heater OFF (safe default)
    print("System initialized. Heater is OFF.")


# ─────────────────────────────────────────
# SENSOR
# ─────────────────────────────────────────
def find_sensor():
    """Find the DS18B20 device file automatically."""
    base_dir = "/sys/bus/w1/devices/"
    device_folders = glob.glob(base_dir + "28-*")
    if not device_folders:
        raise FileNotFoundError(
            "No DS18B20 sensor found.\n"
            "Check: wiring, pull-up resistor, and that 1-Wire is enabled."
        )
    return device_folders[0] + "/w1_slave"


def read_temperature(sensor_file):
    """
    Read temperature from DS18B20.
    Returns temperature in °C, or None if reading fails.
    """
    try:
        with open(sensor_file, "r") as f:
            lines = f.readlines()

        # Line 0 ends with YES if reading is valid
        if "YES" not in lines[0]:
            print("WARNING: Sensor returned invalid reading.")
            return None

        # Line 1 contains t=<value in thousandths of °C>
        temp_string = lines[1].split("t=")[-1].strip()
        temp_c = float(temp_string) / 1000.0
        return temp_c

    except Exception as e:
        print(f"ERROR reading sensor: {e}")
        return None


# ─────────────────────────────────────────
# RELAY CONTROL
# ─────────────────────────────────────────
def heater_on():
    """Turn heater ON via relay."""
    if RELAY_ACTIVE_LOW:
        GPIO.output(RELAY_PIN, GPIO.LOW)
    else:
        GPIO.output(RELAY_PIN, GPIO.HIGH)


def heater_off():
    """Turn heater OFF via relay."""
    if RELAY_ACTIVE_LOW:
        GPIO.output(RELAY_PIN, GPIO.HIGH)
    else:
        GPIO.output(RELAY_PIN, GPIO.LOW)


# ─────────────────────────────────────────
# CONTROL LOGIC
# ─────────────────────────────────────────
def control_loop(sensor_file):
    """
    Main loop:
      1. Read temperature
      2. Check safety limit
      3. Switch heater ON or OFF
    """
    heater_state = "OFF"

    while True:
        temp = read_temperature(sensor_file)

        # ── Sensor failure → fail safe ──
        if temp is None:
            print("FAULT: Sensor read failed. Heater OFF (fail-safe).")
            heater_off()
            heater_state = "OFF"

        # ── Over-temperature emergency ──
        elif temp >= MAX_SAFE_TEMP:
            print(f"[{temp:.2f} °C] EMERGENCY: Over-temperature! Heater OFF.")
            heater_off()
            heater_state = "OFF"

        # ── Below lower threshold → heat ──
        elif temp < TARGET_LOW:
            if heater_state != "ON":
                print(f"[{temp:.2f} °C] Below {TARGET_LOW} °C → Heater ON")
                heater_state = "ON"
            heater_on()

        # ── Above upper threshold → stop heating ──
        elif temp > TARGET_HIGH:
            if heater_state != "OFF":
                print(f"[{temp:.2f} °C] Above {TARGET_HIGH} °C → Heater OFF")
                heater_state = "OFF"
            heater_off()

        # ── Within band → hold current state ──
        else:
            print(f"[{temp:.2f} °C] Within band. Heater {heater_state}.")

        time.sleep(LOOP_DELAY)


# ─────────────────────────────────────────
# CLEANUP
# ─────────────────────────────────────────
def cleanup():
    """Always called on exit — ensures heater is OFF."""
    print("\nShutting down. Heater OFF.")
    heater_off()
    GPIO.cleanup()


# ─────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────
if __name__ == "__main__":
    print("=== Thermal Plant Controller ===")

    try:
        setup()
        sensor_file = find_sensor()
        print(f"Sensor found: {sensor_file}")
        print(f"Target range: {TARGET_LOW} – {TARGET_HIGH} °C")
        print(f"Safety cutoff: {MAX_SAFE_TEMP} °C")
        print("Starting control loop... (Ctrl+C to stop)\n")
        control_loop(sensor_file)

    except FileNotFoundError as e:
        print(f"SETUP ERROR: {e}")

    except KeyboardInterrupt:
        print("Stopped by user.")

    finally:
        cleanup()
