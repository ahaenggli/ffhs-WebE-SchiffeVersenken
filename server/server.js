'use strict';

// Klassen/Funktionen von Extern laden
var User = require('./schiffli').User;
var aRoom = require('./schiffli').Room;
// Port setzen
var port = 8000;


// Server code
var WebSocketServer = require('ws').Server;
// WebServer soll auf Port hören
var server = new WebSocketServer({ port: port });

// neuen Raum Lobby erstellen - Start-Raum für alle
var lobby = new aRoom("Lobby");

// Handler für neue Eingehende Client-Verbindung
server.on('connection', function(socket) {
  // automatisch als User anmelden 
  var user = new User(socket, lobby);
  lobby.addUser(user);
  // Log-Ausabge für Debug 
  console.log("A connection established");
});

// Log-Ausgabe für Debug 
console.log("WebSocket server is running.");
console.log("Listening to port " + port + ".");

