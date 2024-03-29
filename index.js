/*
* Copyright (c) 2015 - 2016 Intel Corporation.
*
* Permission is hereby granted, free of charge, to any person obtaining
* a copy of this software and associated documentation files (the
* "Software"), to deal in the Software without restriction, including
* without limitation the rights to use, copy, modify, merge, publish,
* distribute, sublicense, and/or sell copies of the Software, and to
* permit persons to whom the Software is furnished to do so, subject to
* the following conditions:
*
* The above copyright notice and this permission notice shall be
* included in all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
* NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
* LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
* OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
* WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

"use strict";

// The program is using the Node.js built-in `fs` module
// to load the config.json and html file used to configure the alarm time
var fs = require("fs");

// The program is using the Node.js built-in `path` module to find
// the file path to the html file used to configure the alarm time
var path = require("path");

// Load configuration data from `config.json` file. Edit this file
// to change to correct values for your configuration
var config = JSON.parse(
  fs.readFileSync(path.join(__dirname, "config.json"))
);

// The program is using the `moment` module for easier time-based calculations,
// to determine when the alarm should be sounded.
var moment = require("moment");

// Initialize the hardware for whichever kit we are using
var board;
if (config.kit) {
  board = require("./" + config.kit + ".js");
} else {
  board = require('./grove.js');
}
board.init(config);

var datastore = require("./datastore");
var mqtt = require("./mqtt");

// State of the system
var current;
var night = moment(), morning = moment();

// Start the clock 
// rjf TODO need to check to see if time is in the dark zone
//
var mraa = require("mraa");
var garageLight = new mraa.Gpio(8);
garageLight.dir(mraa.DIR_OUT);

var garageSW = new mraa.Gpio(4);
garageSW.dir(mraa.DIR_IN);
var garageSWState = 0, garageSWNew = 0, garageSWOn = 0;

var frontLightOn = 0;
var garageLightOn = 0; 
var frontBoardClient = require("socket.io-client");
var socketfrontBoard = frontBoardClient.connect("http://192.168.1.61:3000");

// get my ip address
//
var ipAddress = "";

var exec = require('child_process').exec;
    exec('ip a | grep wlan0 | grep inet | awk \'{print substr($2,1,index($2,"/")-1)}\'', function(error, stdout, stderr) {
//    console.log('stdout: ' + stdout + ' stderr: ' + stderr);
    if (error !== null) {
        console.log('In ip discovery: exec error: ' + error);
   }  
   
   ipAddress = stdout.trim();  
   console.log('My ip address is ' + ipAddress );
   });  

function startClockLoop() {
  function after(a, b) { return a.isAfter(b, "second"); }
  function same(a, b) { return a.isSame(b, "second"); }

  setInterval(function() {
    var time = moment();

    // check if display needs to be updated
    // if (after(time, current)) {
    //   if (undefined != alarm) 
    //     {board.message(time.format("h:mm:ss A"),0);
    //      board.message("Alm "+alarm.format("h.mm.ss A"),1);
    //      board.color("blue");}
    //   else
    //     {board.message(time.format("h:mm:ss A"),0);}
    //   if (same(current, alarm)) { startAlarm(); }
    // }
    // current = time;
//  if (after(time, nightoff)) { Start Night Off time ;}
//  if (after(time, morningon)) {turn off night handling }
// add one day to time?
//
    current = time;
    board.message("T "+current.format("h:mm:ss A"),0);
    board.message("ip "+ipAddress,1); 
//    board.message("O "+night.format("h.mm A ")+morning.format("h.mm A"),1);

garageSWNew = garageSW.read();
if (garageSWNew != garageSWState) {
    if (garageSWNew == 1) {
      garageLightOn = 1;
      socketfrontBoard.emit('frontLightOn', { frontLightOn: 'toggle' });
// socket to other machine to turn it's light on
      garageLight.write(1);
      board.color("yellow");
// socket.emit reload web page
    } else { garageLightOn = 0;
      garageLight.write(0);
      board.color("red");
      socketfrontBoard.emit('frontLightOff', { frontLightOff: 'toggle' });

    };
    garageSWState = garageSWNew;
};

}, 200 );

};

var mraa = require("mraa");

// Display and then store record in the remote datastore and/or mqtt server
// of how long the alarm was ringing before it was turned off
function logging(duration) {
  console.log("Time to log something:" + duration);

  var payload = { value: duration };
  datastore.log(config, payload);
  mqtt.log(config, payload);
}


// Starts the built-in web server that serves up the web page
// used to interact with the edison
//
function doServer() {
  var app = require("express")();
  var server = require('http').Server(app);
  var io = require('socket.io')(server);
  var B = 3975;
//  var mraa = require("mraa");
  var a, resistance, tempC, tempF = 999.9;
  var result;




// change this to write into a json file and load into browser every time

function index(res) {
    function stringNserve(err, data) {
      var r1, r2, r3, r4;
      var tempString = tempF.toString();
      var tempShort = tempString.substr(0,4);
      if (err) { return console.log(err); }
          r1 = data.replace(/tempNowXYZZY/, tempShort );
    if (frontLightOn) {
        r2 = r1.replace(/frontLightXYZZY/, "BulbOn.jpg" ); 
         }
    else {
        r2 = r1.replace(/frontLightXYZZY/, "BulbOff.jpg" ); 
         };
    if (garageLightOn) {
        r3 = r2.replace(/garageLightXYZZY/, "BulbOn.jpg" ); 
         }
    else {
        r3 = r2.replace(/garageLightXYZZY/, "BulbOff.jpg" ); 
         };

        r4 = r3.replace(/ipNowXYZZY/, ipAddress );
        console.log("Just replaced IP address to ",ipAddress);
        result = r4;
        res.send(result);
    }
    fs.readFile(path.join(__dirname, "index.html"), {encoding: "utf-8"}, stringNserve);
};

//GROVE Kit A1 Connector --> Aio(1)
var mraa = require("mraa");
var myAnalogPin = new mraa.Aio(1);

console.log("Enabling temperature sensor...");

var myTemperatureInterval = setInterval( function () {
      var a = myAnalogPin.read();
        
      resistance = (1023 - a) * 10000 / a; //get the resistance of the sensor;
      tempC = 1 / (Math.log(resistance / 10000) / B + 1 / 298.15) - 273.15;//convert to temperature via datasheet ;
      //console.log("Celsius Temperature "+celsius_temperature); 
      tempF = (tempC * (9 / 5)) + 32;
}, 10000);


console.log("Enabling distance sensor...");
var ultrasonic = require("jsupm_groveultrasonic");
var sensor = new ultrasonic.GroveUltraSonic(7);


var myProximityInterval = setInterval(function()  {
var travelTime = sensor.getDistance();

if (travelTime > 0) {
    var distance = (travelTime / 29 / 2).toFixed(3);

    if (distance < 50000) {
    console.log("Currenttime ",current, " travelTime "+travelTime+" distance: " + distance + " [cm]");
    };
}
}, 500); 

// When exiting: clear interval and print message

process.on('SIGINT', function()

{
  clearInterval(myProximityInterval);
  clearInterval(myTemperatureInterval);
  console.log("Exiting...");
  process.exit(0);
});

app.get('/', function (req, res) {
  var params = req.query;

    night.hour(+params.nighthour);
    night.minute(+params.nightminute);
    morning.hour(+params.morninghour);
    morning.minute(+params.morningminute);
   

//    if (time.isBefore(moment())) {
//      time.add(1, "day");
//    }
//    alarm = time;

    index(res);
});

app.get('/*.css', function (req, res) {
  res.sendFile(path.join(__dirname, 'styles.css' ));
});

app.get('/BulbOn.jpg', function (req, res) {
  res.sendFile(path.join(__dirname, 'BulbOn.jpg' ));
});

app.get('/BulbOff.jpg', function (req, res) {
  res.sendFile(path.join(__dirname, 'BulbOff.jpg' ));
});

function json(req, res) {
    if (!night  && !morning) { return res.json({ nighthour: 9, nightminute: 9, morninghour: 9, morningminute: 9 }); };

    res.json({
      nighthour: night.hour() || 0,
      nightminute: night.minute() || 0, 
      morninghour: morning.hour() || 0,
      morningminute: morning.minute() || 0
    });

    morning = morning.add(1, "day");

    console.log("in res.json night ", night);
    console.log("in res.json morning ", morning);
};


app.get('/alarm.json', json );


server.listen(3000);


io.on('connection', function (socket) {

socket.on('garageLightToggle', function(data) {
    console.log("in server got garageLightToggle message ",data);
    garageLightOn = !garageLightOn;
    console.log("In server socket, garageLight now ", garageLightOn);
    if (garageLightOn == 1) 
      { garageLight.write(1); board.color("yellow") }
    else 
      { garageLight.write(0); board.color("red") };
    socket.emit('reload', true);

});

socket.on('garageLightOn', function(data) {
    console.log("in server got garageLightOn message ",data);
    garageLightOn = 1;  
    console.log("In server socket, garageLight ", garageLightOn);
    garageLight.write(1);
    board.color("yellow");
    socket.emit('reload', true);
});


socket.on('garageLightOff', function(data) {
    console.log("in server got garageLightOff message ",data);
    garageLightOn = 0;  
    console.log("In server socket, garageLight ", garageLightOn);
    garageLight.write(0);
    board.color("red");
    socket.emit('reload', true);
});





});
};

// Set new alarm time submitted by the web page using HTTP GET


function main() {
console.log("project Maui Starting...")
  board.stopBuzzing();
//  board.setupEvents();

  startClockLoop();
  doServer();
}

main();
