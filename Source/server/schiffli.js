'use strict';

// Constants
var CHAT_MESSAGE = 100;
var CHAT_ROOM = 101;


var LINE_SEGMENT = 0;
var GAME_LOGIC = 2;


// Constant for game logic state
var WAITING_TO_START = 0;
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

    console.log("[Room`"+user.room.Roomname+"`] Receive message from [" + user.id + "]: " + message);

    // construct the message
    var data = JSON.parse(message);

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



};

// inherit Room
class GameRoom extends Room {
constructor(rn) {
  super(rn);
  // the current turn of player index.
  this.playerTurn = 0;
  this.isPlayRoom = 1;

  this.wordsList = ['apple','idea','wisdom','angry'];
  this.currentAnswer = undefined;

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

  // start the game if there are 2 or more connections
	if (this.currentGameState === WAITING_TO_START && this.users.length >= 2) {
		this.startGame();
	}
};

startGame() {
  var room = this;

	// pick a player to draw
	this.playerTurn = (this.playerTurn+1) % this.users.length;

  console.log("Start game with player " + this.playerTurn + "'s turn.");

	// pick an answer
	var answerIndex = Math.floor(Math.random() * this.wordsList.length);
	this.currentAnswer = this.wordsList[answerIndex];

	// game start for all players
	var gameLogicDataForAllPlayers = {
    dataType: GAME_LOGIC,
    gameState: GAME_START,
    isPlayerTurn: false
  };

	this.sendAll(JSON.stringify(gameLogicDataForAllPlayers));

	// game start with answer to the player in turn.
	var gameLogicDataForDrawer = {
    dataType: GAME_LOGIC,
    gameState: GAME_START,
    answer: this.currentAnswer,
    isPlayerTurn: true
  };

  // the user who draws in this turn.
  var user = this.users[this.playerTurn];
  user.socket.send(JSON.stringify(gameLogicDataForDrawer));

	room.currentGameState = GAME_START;
};

};

module.exports.User = User;
module.exports.Room = Room;
module.exports.GameRoom = GameRoom;