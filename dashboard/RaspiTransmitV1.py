#!/usr/bin/env python3

import serial # we are importing the liblary serial.
import time # we are importing the liblary time. 

''' serial.Serial basically creates a serial communication connection between your Python program on the Raspberry Pi and
the Arduino connected through USB port called /dev/ttyACM0 and we set the same baud rate here so that the raspberry pi knows
what baud rate to expect form the aurdino for the uart communication.  '''

ser = serial.Serial('/dev/ttyACM0', 115200, timeout = 1.0)
time.sleep(2) #The reason we do a delay of 2 seconds in the python program is because when we open a serial communction form the code above the audino will restart so we give some time for the aurdion to restart.
ser.reset_input_buffer() # when the data arrives it's in a buffer so when you read you read form a buffer.
print("Serial OK")

# We use a try/except block so that the program can run the infinite loop safely.
# The Arduino continuously sends data and the Raspberry Pi continuously reads it.
# When we stop the program using Ctrl + C, a KeyboardInterrupt exception occurs.
# Instead of the program crashing and leaving the serial port open, the except block
# catches and runs and safely closes the serial communication.

try: 
    while True: # we create the infinite loop so that we keep reading the data form the aurdino as the aurdino also runs on infintie loop.
     time.sleep(1)
     print("sending message to aurdino!")
     ser.write("Hello from Raspberry PI\n".encode('utf-8')) # we write to the aurdino with the attribute write fomr the serial liblary. we must have \n so the aurdino does not wait for a second. and endcode with utf-8 
      
except KeyboardInterrupt: 
     print("Close Serial Communication")
     ser.close() 
      

