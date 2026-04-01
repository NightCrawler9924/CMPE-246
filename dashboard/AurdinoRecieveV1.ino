 unsigned long lastTime; 
 int greenLED = 9; 
 int buzzer = 10;
 int redLED = 11;


void setup(){

pinMode(greenLED, OUTPUT);
pinMode(redLED, OUTPUT);
pinMode(buzzer, OUTPUT);

 

 Serial.begin(115200);
 lastTime = millis();
 Serial.println("Starting Time"+ lastTime);
 digitalWrite(greenLED, LOW);
 digitalWrite(redLED, LOW);
 digitalWrite(buzzer, LOW);
  
  }
  
  
 void loop(){
  
  if(Serial.available()>0){
     String message = Serial.readStringUntil('\n');  
     Serial.println(message);
     lastTime = millis(); 
     
   }

   if(millis() - lastTime > 3000){
    digitalWrite(redLED, HIGH);
    digitalWrite(buzzer, HIGH);
    delay(1000);
    digitalWrite(greenLED, LOW);
    

    } else{
     digitalWrite(buzzer, LOW);
     digitalWrite(greenLED, HIGH);
     digitalWrite(redLED, LOW);
    }
    

 }
