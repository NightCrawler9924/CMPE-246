import time
import RPi.GPIO as GPIO
import glob
import os

GPIO.setmode(GPIO.BCM) # USe the GPIO numbers instead of physical pin numbers

temp_data = 4 
pump_relay = 17
Red_LED = 27
Green_LED = 22
Blue_LED = 25
Buzzer = 12 



GPIO.setup(pump_relay, GPIO.OUT) # Setting GPIO pin 17 to output pin
GPIO.setup(Red_LED, GPIO.OUT) # Setting GPIO pin 27 to output pin
GPIO.setup(Green_LED, GPIO.OUT) # Setting GPIO pin 22 to output pin
GPIO.setup(Blue_LED, GPIO.OUT) # Setting GPIO pin 25 to output pin
GPIO.setup(Buzzer, GPIO.OUT) # Setting GPIO pin 12 to output pin
over_temp_start = None 

os.system('modprobe w1-gpio') #this enables the GPIO temperature driver 
os.system('modprobe w1-therm') #this enables the temperature sensor driver


# For the DS18B20, you do NOT read temperature using GPIO.input().
# The sensor writes temperature to a file in Linux, and you read that file.
# So GPIO4 is just the data line, but you don’t read it like a digital pin.

def read_temperature():	
    device_folder = glob.glob('/sys/bus/w1/devices/28-*')[0] # the folder is created here  
    device_file = device_folder + '/w1_slave' # Inside that folder we are reading the w1_slave file.
    open_file  = open(device_file, 'r') # we are opening the file so that we can read form it
    lines = open_file.readlines()
    # readlines() reads the entire file and stores each line as an element in a list
    # lines[0] = first line (contains YES / CRC check)
    # lines[1] = second line (contains temperature value after "t=")
    open_file.close()
    
    temp_string = lines[1].split('t=')[1]
    # lines[1] is the second line of the file, which contains something like:
    # "aa bb cc dd t=23125"
    # split('t=') separates the string into two parts:
    # ["aa bb cc dd ", "23125"]
    # [1] selects the second part, which is the temperature number (23125)
    temp_c = float(temp_string) / 1000.0
    
    return temp_c


while True:
    temp = read_temperature() # since the function returns the temperature we save that temperature value in the temp variable
    print(temp)

    if temp > 58:
        # start timer
        GPIO.output(pump_relay, GPIO.HIGH) # turing the GPIO pin on to turn the realy on so that that pump starts pumping the water to cool the metal block.
        GPIO.output(Blue_LED, GPIO.HIGH)# turing the blue led on to indicate that we are above 55 degrees and the water is being pumped to lower the temperature
        if over_temp_start is None: # intially the variable over_temp_start is None so when we are above 58 and we enter this if statment we run the next line. 
          over_temp_start = time.time()   # this starts the timer. so it uses the the system clock and sets the value that it see when we reach this line. and now this will be set and won't be changed until
                                         # until we reset it in the elif statment. 

        if time.time() - over_temp_start > 10: # when we have the difference of more than 10 seconds between the current time and the saved time in the variable over_temp_start we run the next line. 
            GPIO.output(Red_LED, GPIO.HIGH) # turing on the RED led to show the neuclar reacotr must be shut off manually as the water is unable to cool the block back down to 55 degrees. 
            GPIO.output(Buzzer, GPIO.HIGH) # turing on the Buzzer.
            GPIO.output(pump_relay,GPIO.LOW) # Turning off the pump as we don't wanna waste water as we see the water has been pumping for 10 seconds and that is not cooling the sytem.
            print("MANUAL SHUT OFF");
               
    elif temp < 55:
        GPIO.output(pump_relay, GPIO.LOW) # the pump is initally off or turns off when we are in the range of 55 degrees celcius as that's where we want to maintiang the temperature of the system.
        GPIO.output(Green_LED, GPIO.HIGH) # turning the green led showcasing that the system is within the appropriate temperature.
        over_temp_start = None # set the timer back to None if we get back to 55 degreens within 10 seconds. 
    time.sleep(0.2)
    

       
       
    
    



