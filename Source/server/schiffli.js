'use strict';

// Globale Variablen
// Message-Typen
var CHAT_MESSAGE = 100;
var CHAT_ROOM = 101;
var GAME_LOGIC = 200;

// Variablen für Game-Logik
var WAITING_TO_START = 0;
var GAME_sendSchiffe = 201;
var GAME_versenkeSchiffe = 202;
var GAME_START = 1;
var GAME_OVER = 2;
var GAME_RESTART = 3;

/* User */
class User {
  /*socket = "";
  room = "";
  lobby = "";
  id = 0;
  Username = "";*/
  
  constructor(socket, room) {
  // Verbindung/Socket
  this.socket = socket;
  this.room   = room;
  this.lobby  = room;

  // zufaellige UserID
  this.id = "1" + Math.floor( Math.random() * 1000000000);
  this.Username = "";

  // message-Listener auf User selber, da dieser den Raum wechseln kann um zu spielen
  this.handleOnUserMessage();
  this.handleOnUserLeft();
};

// UserName setzen
setUsername(str){
  this.Username = str;
};

setRoom(rom){
    this.room = rom;
};

handleOnUserMessage() {
  var user = this;  
  // handle on message
  user.socket.on("message", function(message){
    console.log("[User`"+user.Username+"`] sent message: " + message);
    user.room.handleOnUserMessage(user, message);
  });
};

handleOnUserLeft() {
  var user = this;
  var room = this.room;
  // handle user closing
  user.socket.onclose = function(){
    console.log("A connection left.");
    room.removeUser(user);
  };
  room.sendDetails();
};


};




/* Raum */ 
class Room {

constructor(rn) {
    this.users = [];
    this.Roomname = rn;
    this.counter = 1;
    this.isPlayRoom = 0;
}

addUser(user){

  if(user.Username === "")  user.setUsername("u"+this.counter);
  this.users.push(user);
  this.counter++;
  
  var room = this;
  room.sendDetails();
  // tell others that someone joins the room
  var data = {
    dataType: CHAT_MESSAGE,
    sender: "Server",
    message: "Welcome " + user.Username + " joining the Room `"+room.Roomname+"`. Total connection: " + this.users.length
  };
  this.sendAll(JSON.stringify(data));
};

removeUser(user) {
  // loop to find the user
  for (var i=this.users.length; i >= 0; i--) {
    if (this.users[i] === user) {
      this.users.splice(i, 1);
    }
  }
  var room = this;
  room.sendDetails();
};

sendAll(message) {
  for (var i=0, len=this.users.length; i<len; i++) {
    this.users[i].socket.send(message);
  }
};

sendDetails(){
  console.log('sendDetails');
  var room = this;
  var cpy = [];

  room.users.forEach(u => { 
    cpy.push({Username: u.Username});        
  });
  var msg = JSON.stringify({
    roomName: room.Roomname, 
    userList: cpy,
    isPlayRoom: room.isPlayRoom
  
  });

  var data = {
    dataType: CHAT_ROOM,
    sender: "Server",
    message: msg
  };
  room.sendAll(JSON.stringify(data));
};


handleOnUserMessage(user, message){

  // construct the message
    var data = JSON.parse(message);

    if (data.dataType === GAME_LOGIC) return;
    if (data.dataType === CHAT_MESSAGE) {
			// add the sender information into the message data object.
			data.sender = user.Username;
    }

    if (typeof data.message !== 'undefined'){
        if(data.message.startsWith("/nick ")) {
        console.log("Kommando: /nick");
        user.setUsername(data.message.replace("/nick ", ""));
        user.room.sendDetails();

        data = {
          dataType: CHAT_MESSAGE,
          sender: "Server",
          message: "User ["+data.sender + "] heisst neu ["+user.Username+"]"
        };
        
      } // Kommando /play wechselt dem Raum bei Erfolg
      else if(data.message.startsWith("/play ")) {
        let otherName = data.message.replace("/play ", "");
        let otherIdx = user.room.users.findIndex(e => e.Username.trim() == otherName );

        console.log("/playResult: " + otherIdx);

        if(otherIdx == -1){
            
          data = {
            dataType: CHAT_MESSAGE,
            sender: "Server",
            message: "User ["+otherName + "] nicht gefunden"
          };

        }else {
          let other = user.room.users[otherIdx];

          user.room.removeUser(user);
          user.room.removeUser(other);

          user.setRoom(new GameRoom(user.Username + " vs. " + otherName));
          
          other.setRoom(user.room);
          user.room.addUser(user);
          user.room.addUser(other);
        }
        

      }
      else if(data.message.startsWith("/quit")) {
        
        console.log("/quit: " + user.Username);
            
          data = {
            dataType: CHAT_MESSAGE,
            sender: "Server",
            message: "User ["+user.Username + "] quitted"
          };
          user.room.sendAll(JSON.stringify(data));

          user.room.removeUser(user);
          user.room = user.lobby;
          user.lobby.addUser(user);


          data = {
            dataType: CHAT_MESSAGE,
            sender: "Server",
            message: "User ["+user.Username + "] joined"
          };

        }
      }//message ist gesetzt

    // send to all clients in room.
    user.room.sendAll(JSON.stringify(data));

};


};

// GameRoom erbt von Room
class GameRoom extends Room {

  constructor(rn) {
    super(rn);
    // the current turn of player index.
    this.playerTurn = 0;
    this.isPlayRoom = 1;
    this.cntRunde   = 1;

    this.SchiffePos = [];

    this.currentGameState = WAITING_TO_START;

    // send the game state to all players.
    var gameLogicData = {
      dataType: GAME_LOGIC,
      gameState: WAITING_TO_START
    };

	this.sendAll(JSON.stringify(gameLogicData));

};

addUser(user) {
    super.addUser(user);
    
    this.SchiffePos[user.id] =     {
       sindBooteGesetzt: false,
       Boote : []      
    };

  // start the game if there are 2 or more connections
	if (this.currentGameState === WAITING_TO_START && this.users.length == 2) {
		this.startGame();
  }
  
};

handleOnUserMessage(user, message){
  var room = this;
  super.handleOnUserMessage(user, message);

    var data = JSON.parse(message);

    if (data.dataType === GAME_LOGIC) {
      console.log("Game-Room [" + user.Username + "]: ...");

      if(data.gameState === GAME_sendSchiffe){
        this.SchiffePos[user.id] = {sindBooteGesetzt: true,
                                    Boote: data.message.split('|') };

        console.log(this.users[0].id);
        console.log(this.users[1].id);
        console.log(this.SchiffePos[this.users[0].id].sindBooteGesetzt);
        console.log(this.SchiffePos[this.users[1].id].sindBooteGesetzt);


        if(this.SchiffePos[this.users[0].id].sindBooteGesetzt &&
          this.SchiffePos[this.users[1].id].sindBooteGesetzt){
  
            console.log("Boote sind gesetzt...");
  
  
             this.WechsleSpieler();
  
  
          }
      }

      if(data.gameState === GAME_versenkeSchiffe){
          this.WechsleSpieler();
      }
   

    }



};

WechsleSpieler(){
   // pick a player to draw
   var room = this;
   var other = this.playerTurn;
   this.playerTurn = (this.playerTurn+1) % this.users.length;

   // game start with answer to the player in turn.
   var gameLogicDataForDrawer = {
     dataType: GAME_LOGIC,
     gameState: GAME_START,
     isPlayerTurn: true
   };

   // the user who draws in this turn.
   var user = this.users[this.playerTurn];
   user.socket.send(JSON.stringify(gameLogicDataForDrawer));

   gameLogicDataForDrawer = {
     dataType: GAME_LOGIC,
     gameState: GAME_START,
     isPlayerTurn: false
   };

   user = this.users[other];
   user.socket.send(JSON.stringify(gameLogicDataForDrawer));

   room.currentGameState = GAME_START;
};

startGame() {
  var room = this;

	// pick a player to draw
	this.playerTurn = (this.playerTurn+1) % this.users.length;
  
  var tUser = this.users[this.playerTurn];

  console.log("Start game with player [" + tUser.Username + "]'s turn.");

	// Allen mitteilen, dass Schiffe platziert werden können
	var gameLogicDataForAllPlayers = {
    dataType: GAME_LOGIC,
    gameState: WAITING_TO_START,
    isPlayerTurn: true
  };

	this.sendAll(JSON.stringify(gameLogicDataForAllPlayers));

  
};

};

module.exports.User = User;
module.exports.Room = Room;
module.exports.GameRoom = GameRoom;