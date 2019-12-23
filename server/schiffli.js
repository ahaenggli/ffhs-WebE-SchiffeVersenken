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
var GAME_Wasser = 203;
var Game_Treffer = 204;
var GAME_ShipNotValid = 205;

var GAME_START = 1;
var GAME_RESTART = 3;

/* User-Klasse */
class User {

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
// Raum setzen
setRoom(rom){
    this.room = rom;
};

// Neue Nachrichten von user-Socket kommen hier rein
handleOnUserMessage() {
  var user = this; // der aktuelle User
  user.socket.on("message", function(message){
    console.log("[User`"+user.Username+"`] sent message: " + message);
    user.room.handleOnUserMessage(user, message);
  });
};

// Benutzer verliert/schliesst Verbindung
handleOnUserLeft() {
  var user = this;
  var room = this.room;

  user.socket.onclose = function(){
    console.log("A connection left.");
    // Benutzer aus Raum entfernen
    room.removeUser(user);
  };
  // geänderte Raum-Details an alle Chat-Partner senden
  room.sendDetails();
};


}; // User-Klasse fertig


/* Raum-Klasse */
class Room {

// Konstruktor
constructor(rn) {
    this.users = [];
    this.Roomname = rn;
    this.counter = 1;
    this.isPlayRoom = 0;
}

// User kommt in den Raum hinzu
addUser(user){
  // Default-Username setzen (u[n+1])
  if(user.Username === "")  user.setUsername("u"+this.counter);
  this.users.push(user);
  this.counter++; //counter hochzählen

  // aktuellen Raum ermitteln und neue Details an alle User versenden (damit diese auch wissen, dass es einen neuen hat)
  var room = this;
  room.sendDetails();

  // zusätzlich mittels Chat-Nachricht den user auch anzeigen
  var data = {
    dataType: CHAT_MESSAGE,
    sender: "Server",
    message: "Welcome " + user.Username + " joining the Room `"+room.Roomname+"`. Total connection: " + this.users.length
  };
  this.sendAll(JSON.stringify(data));
};

// User aus dem Raum entfernen
removeUser(user) {
  // User in Array suchen und "rausschneiden"
  for (var i=this.users.length; i >= 0; i--) {
    if (this.users[i] === user) {
      this.users.splice(i, 1);
    }
  }
  // geänderte Raumdetails wieder an alle senden
  var room = this;
  room.sendDetails();
};

// Die Nachricht an alle User im Raum senden
sendAll(message) {
  // Alle User iterieren
  for (var i=0, len=this.users.length; i<len; i++) {
    // über den Socket eines jeden einzelnen die Nachricht senden
    this.users[i].socket.send(message);
  }
};

// Raum-Details an alle senden
sendDetails(){
  console.log('sendDetails');
  var room = this;
  var cpy = [];

  // Liste sämtlicher Usernamen
  room.users.forEach(u => {
    cpy.push({Username: u.Username});
  });
  // ... zusammen mit Raum-Name und ob es ein Spiel-Raum ist (oder nicht)
  var msg = JSON.stringify({
    roomName: room.Roomname,
    userList: cpy,
    isPlayRoom: room.isPlayRoom
  });

  // .. als Server-Nachricht
  var data = {
    dataType: CHAT_ROOM,
    sender: "Server",
    message: msg
  };
  // .. an alle User im Raum senden
  room.sendAll(JSON.stringify(data));
};

// Funktion ist zwar mit User verbunden, dort wird es aber an den Raum delegiert
handleOnUserMessage(user, message){

    // Message in JSON-Objekt umwandeln für Datenzugriff
    var data = JSON.parse(message);
    // Spiel-Logik hat hier nichts zu suchen, kommt dann im GameRoom noch ...
    if (data.dataType === GAME_LOGIC) return;

    // Chat-Nachricht
    if (data.dataType === CHAT_MESSAGE) {
			// Absender ergänzen, die anderen wollen ja wissen, vom wem die Nachricht war
			data.sender = user.Username;
    }
    // Es hat eine Nachricht drin
    if (typeof data.message !== 'undefined'){
      /*
      * Diverse mögliche Kommando abarbeiten
      */
      //UserName soll geändert werden
        if(data.message.startsWith("/nick ")) {
        console.log("Kommando: /nick");
        // Username überschreiben und alle User informieren
        user.setUsername(data.message.replace("/nick ", ""));
        user.room.sendDetails();

        // zusätzlich eine Nachricht an alle vorbereiten
        data = {
          dataType: CHAT_MESSAGE,
          sender: "Server",
          message: "User ["+data.sender + "] heisst neu ["+user.Username+"]"
        };
      }
      // Kommando /play wechselt dem Raum bei Erfolg
      else if(data.message.startsWith("/play ")) {
        // mit wem will aktueller User spielen?
        let otherName = data.message.replace("/play ", "");
        let otherIdx = user.room.users.findIndex(e => e.Username.trim() == otherName );

        console.log("/playResult: " + otherIdx);

        // Gibt es den überhaupt?
        if(otherIdx == -1){
          //nein, nachricht vorbereiten
          data = {
            dataType: CHAT_MESSAGE,
            sender: "Server",
            message: "User ["+otherName + "] nicht gefunden"
          };
          // ja, es gibt ihn
        }else {
          let other = user.room.users[otherIdx];

          // aktuellen User und Spielpartner aus aktuellem Raum entfernen
          user.room.removeUser(user);
          user.room.removeUser(other);

          // neuen Raum eröffnen und beide darin zuordnen
          user.setRoom(new GameRoom(user.Username + " vs. " + otherName));
          other.setRoom(user.room);
          user.room.addUser(user);
          user.room.addUser(other);
          //--> Die User werden im addUser noch über die neuen Raum-Details informiert
        }


      }
      // Raum verlassen und in Lobby zurückkehren
      else if(data.message.startsWith("/quit")) {

        console.log("/quit: " + user.Username);
          //info vorbereiten und senden
          data = {
            dataType: CHAT_MESSAGE,
            sender: "Server",
            message: "User ["+user.Username + "] quitted"
          };
          user.room.sendAll(JSON.stringify(data));
          // user entfernen
          user.room.removeUser(user);
          // .. und an Lobby zuweisen
          user.room = user.lobby;
          user.lobby.addUser(user); // in addUser werden wieder alle informiert

          // Nachricht vorbereiten
          data = {
            dataType: CHAT_MESSAGE,
            sender: "Server",
            message: "User ["+user.Username + "] joined"
          };

        }
        // alles andere müssten nun Chat-Nachrichten sein
        else {
          // Aus Sicherheitsgründen werden sämtliche Zeichen durch den Code ersetzt
          // dadruch bleiben auch alle <>/*[]" erhalten und es kann nichts "eingeschleust" werden
          data.message = data.message.replace(/[\u00A0-\u9999<>\&]/gim, function(i) {
          return '&#'+i.charCodeAt(0)+';';
         });

        }
      }//message ist gesetzt

    // vorbereitete Nachricht an alle senden
    user.room.sendAll(JSON.stringify(data));

};


}; // Klasse Raum fertig

// GameRoom erbt von Room alles und kann dann überschreiben/ergänzen
class GameRoom extends Room {

  constructor(rn) {
    // Konstruktor von Raum aufrufen, so muss Code nicht dupliziert werden
    super(rn);
    // GameRoom-Spezifische Daten
    this.playerTurn = 0;
    this.isPlayRoom = 1;
    this.cntRunde   = 1;
    this.SchiffePos = [];
    this.currentGameState = WAITING_TO_START;

    // Aktuellen Status an alle senden
    var gameLogicData = {
      dataType: GAME_LOGIC,
      gameState: WAITING_TO_START
    };
	this.sendAll(JSON.stringify(gameLogicData));

};

// Es kommt ein User in den Game-Raum dazu
addUser(user) {
    // normale Logik aufrufen
    super.addUser(user);
    // User-spezifische Spielvariable initialisieren
    this.SchiffePos[user.id] =     {
       sindBooteGesetzt: false,
       Boote : "",
       Getroffen : ""
    };

  // Es kann 'richtig' losgehen, sobald 2 Leute im Raum sind
	if (this.currentGameState === WAITING_TO_START && this.users.length == 2) {
		this.startGame();
  }

};
// sind Schiffe valide platziert?
areSchiffliValide(strSchiffe){

	// undefined -> kann nicht valide sein
	if(strSchiffe == undefined) return false;

	// nichts gesetzt auch nicht
	if(strSchiffe.length <= 0) return false;

	// Anzahl genutze Boote-Felder != erlaubte Bootefelder
	if(strSchiffe.split('|').length-1 != (1*5 + 2*4 + 3*3 + 4*2) ) return false;

	// Spielfeld-Grösse
	var size = 10 + this.cntRunde-1;

	// Platzierte Boote finden
	var fldGenutzt = [];
	var defBoote = [];
	for (var feld of strSchiffe.split('|')){
		//Feld noch von keinem anderen "Schiff" genutzt
		if(feld != undefined && feld != "" && fldGenutzt.indexOf(feld) == -1){
			var mySchiff = [];
			mySchiff.push(feld); //Startfeld kommt da immer drin vor
			// 'feld' ist unser Startpunkt, suche nun umliegende Felder ab bis Boot "zusammengesetzt"
			var trenneBuchstabeZahl = feld.match(/[a-z]+|[^a-z]+/gi);
			var Buchstabe = trenneBuchstabeZahl[0];
			var Zahl      = trenneBuchstabeZahl[1];

			// ausserhalb Spielfeld platziert -> abbruch, Platzierung kann nicht valide sein
			if(Zahl > size || Buchstabe.charCodeAt(0) > 65+size ) return false;

			//selbe Linie, nach rechts suchen
			var r = Zahl;
			r++;
			var potentiellesFeld = Buchstabe+r;
			while(strSchiffe.includes(potentiellesFeld+'|') && fldGenutzt.indexOf(potentiellesFeld) == -1){
				mySchiff.push(potentiellesFeld);
				fldGenutzt.push(potentiellesFeld);
				r++;
				potentiellesFeld = Buchstabe+r;
			}

			//selbe Linie, nach links suchen
			var l = Zahl;
			l--;
			var potentiellesFeld = Buchstabe+l;
			while(strSchiffe.includes(potentiellesFeld+'|') && fldGenutzt.indexOf(potentiellesFeld) == -1){
				mySchiff.push(potentiellesFeld);
				fldGenutzt.push(potentiellesFeld);
				l--;
				potentiellesFeld = Buchstabe+l;
			}


			//selbe Spalte, nach unten
			var bu = Buchstabe.charCodeAt(0);
			bu++;
			var potentiellesFeld = String.fromCharCode(bu)+Zahl;
			//console.log(potentiellesFeld);
			while(strSchiffe.includes(potentiellesFeld+'|') && fldGenutzt.indexOf(potentiellesFeld) == -1){
				mySchiff.push(potentiellesFeld);
				fldGenutzt.push(potentiellesFeld);
				bu++;
				potentiellesFeld = String.fromCharCode(bu)+Zahl;
			}

			//selbe Spalte, nach oben
			var bo = Buchstabe.charCodeAt(0);
			bo--;
			var potentiellesFeld = String.fromCharCode(bo)+Zahl;
			//console.log(potentiellesFeld);
			while(strSchiffe.includes(potentiellesFeld+'|') && fldGenutzt.indexOf(potentiellesFeld) == -1){
				mySchiff.push(potentiellesFeld);
				fldGenutzt.push(potentiellesFeld);
				bo--;
				potentiellesFeld = String.fromCharCode(bo)+Zahl;
			}
			defBoote.push(mySchiff);

		}
	}//for


	console.log(defBoote);

	// es müssen genau 10 Boote sein
	if(defBoote.length != 10) return false;

	// Längen der Boote validieren
	var tLng = {};
	for(var boot of defBoote){
		tLng[boot.length] = tLng[boot.length]+1 || 1;
	}

	// Boot mit Länge 5 gibt's nicht
	if(tLng[5] == undefined || tLng[5] != 1) return false;
	// Boot mit Länge 4 gibt's nicht
	if(tLng[4] == undefined || tLng[4] != 2) return false;
	// Boot mit Länge 3 gibt's nicht
	if(tLng[3] == undefined || tLng[3] != 3) return false;
	// Boot mit Länge 2 gibt's nicht
	if(tLng[2] == undefined || tLng[2] != 4) return false;

	// alles andere war i.O. somit muss Platzierung valide sein
	return true;
}
// Funktion ist zwar mit User verbunden, dort wird es aber an den Raum delegiert
handleOnUserMessage(user, message){
  var room = this; //aktuellen Raum bestimmen
  // Code-Duplikate vermeiden, Methode aus vererbtem Teil aufrufen
  super.handleOnUserMessage(user, message);

  // Abhandlung nur fürs Game
  var data = JSON.parse(message);

  if (data.dataType === GAME_LOGIC) {
  console.log("Game-Room: [" + user.Username + "] ...");

    // Schiiffe platziert
   if(data.gameState === GAME_sendSchiffe){
     // sind Schiffe valide gesetzt worden?
    var valide = this.areSchiffliValide(data.message);
    console.log("areSchiffliValide: " +valide);
    if(valide){

      // Positionen merkeen
      this.SchiffePos[user.id] = {sindBooteGesetzt: true,
                                    Boote: data.message,
                                    Getroffen : ""
                                   };
        // Diverse Debugs..
        /*console.log(this.users[0].id);
        console.log(this.users[1].id);
        console.log(this.SchiffePos[this.users[0].id].sindBooteGesetzt);
        console.log(this.SchiffePos[this.users[1].id].sindBooteGesetzt);
        */

        // haben schon beide Spiele die Schiffe gesetzt?
        if(this.SchiffePos[this.users[0].id].sindBooteGesetzt &&
          this.SchiffePos[this.users[1].id].sindBooteGesetzt){
            // juppa, es kann somit losgehen ..
            console.log("Boote sind gesetzt...");
            this.currentGameState = GAME_START;
            this.WechsleSpieler();
          }
    }else{
         // Rückmeldung geben, dass Schiffe nicht valide sind
              // Nachricht vorbereiten
          var sndBootNotValid = {
            dataType: GAME_LOGIC,
            gameState: GAME_ShipNotValid,
            message: 'Boote nicht valide'
          };
         user.socket.send(JSON.stringify(sndBootNotValid));
    }
  }
    // Versuche ein Boot zu versenken
      if(data.gameState === GAME_versenkeSchiffe){
          console.log("GAME_versenkeSchiffe");

      // Hier sollte man nur sein, wenn beide Spiele auch die Boote gesetzt haben, sonst weitergehen
      if(this.SchiffePos[this.users[0].id].sindBooteGesetzt && this.SchiffePos[this.users[1].id].sindBooteGesetzt){

          var myId = user.id;
          var otherId = ((user.id == this.users[0].id))? this.users[1].id : this.users[0].id;
          var otherUser = ((user.id == this.users[0].id))? this.users[1] : this.users[0];

          console.log("Ich bin:" + user.Username);
          console.log("ID: " + user.id);
          console.log("ID: " + myId);
          console.log("Der andere ist: " + otherId);

        // Bin ich auch wirklich wirklich dran?
        if(this.users[this.playerTurn].id == myId){

          // Nachricht vorbereiten
          var sndTreffer = {
            dataType: GAME_LOGIC,
            gameState: -1,
            message: 'g'+data.message
          };

          // Ist an Ziel Wasser oder Boot?
          if(this.SchiffePos[otherId].Boote.includes(data.message+"|")){
            console.log("Treffer!");
            if(!this.SchiffePos[otherId].Getroffen.includes(data.message+"|")) this.SchiffePos[otherId].Getroffen += data.message+"|";
            sndTreffer.gameState = Game_Treffer;
          }else{
            console.log("Wasser :( ");
            sndTreffer.gameState = GAME_Wasser;
          }
          // Rückmeldung senden
          user.socket.send(JSON.stringify(sndTreffer));
          // "betroffenen" auch informieren
          sndTreffer.message = 'i'+data.message;
          otherUser.socket.send(JSON.stringify(sndTreffer));

          // alles versenkt, (er/sie/es) hat verloren!
          if(this.SchiffePos[otherId].Getroffen.length == this.SchiffePos[otherId].Boote.length){
              var data = {
                dataType: CHAT_MESSAGE,
                sender: "Server",
                message: "User " + user.Username + " hat gewonnen."
              };
              room.sendAll(JSON.stringify(data));

              // Runde erhöhen
              this.cntRunde++;
              data = {
                dataType: GAME_LOGIC,
                gameState: GAME_RESTART,
                message: "User " + user.Username + " hat gewonnen.",
                newRunde: this.cntRunde
              };
              room.sendAll(JSON.stringify(data));
              this.currentGameState = GAME_RESTART;
              // Variablen zurücksetzen
             this.SchiffePos[myId] =     {
                sindBooteGesetzt: false,
                Boote : "",
                Getroffen : ""
             };
             this.SchiffePos[otherId] =     {
              sindBooteGesetzt: false,
              Boote : "",
              Getroffen : ""
           };

          }
          // der andere ist nun dran mit dem Zug
          this.WechsleSpieler();
        }//ich war wirklich wirklich dran
        else { console.log("!!!!: User war nicht dran?! ");}
        }// beide Spieler haben Boote gesetzt
      } // versuche Boot zu versenken
    }//GAME-Logik

};

// Spieler sollen sich abwechseln
WechsleSpieler(){
   // aktuellen Raum festlegen
   var room = this;
   // der andere war vorhin dran
   var other = this.playerTurn;
   // nun der, der halt nicht dran war (Modulo-Operation, durch Rest-Klassen kommt so immer 0 oder 1 raus)
   this.playerTurn = (this.playerTurn+1) % this.users.length;


   // der Spieler am Zug wird darüber informiert, dass er dran ist
   // als Detail wird noch mitgesendet, welche Runde gerade gespielt wird
   var gameLogicDataForDrawer = {
     dataType: GAME_LOGIC,
     gameState: this.currentGameState ,
     newRunde: this.cntRunde,
     isPlayerTurn: true
   };

   // Ausnahme: Schiffe wurden noch nicht platziert, dann ist nämlich noch niemand an der Reihe
   if(!this.SchiffePos[this.users[0].id].sindBooteGesetzt && !this.SchiffePos[this.users[1].id].sindBooteGesetzt) gameLogicDataForDrawer.isPlayerTurn = false;

   var user = this.users[this.playerTurn];
   user.socket.send(JSON.stringify(gameLogicDataForDrawer));

   // Beim anderen User dasselbe, der ist aber so oder so nicht an der Reihe
   gameLogicDataForDrawer = {
     dataType: GAME_LOGIC,
     gameState: this.currentGameState ,
     newRunde: this.cntRunde,
     isPlayerTurn: false
   };

   user = this.users[other];
   user.socket.send(JSON.stringify(gameLogicDataForDrawer));

};

// Spiel kann starten
startGame() {
  // Allen mitteilen, dass Schiffe platziert werden können
  this.currentGameState = WAITING_TO_START;
	var gameLogicDataForAllPlayers = {
    dataType: GAME_LOGIC,
    gameState: this.currentGameState,
    isPlayerTurn: false
  };
	this.sendAll(JSON.stringify(gameLogicDataForAllPlayers));
};

};

/* Module exportieren, damit sie in NodeJS via require geladen werden können */
module.exports.User = User;
module.exports.Room = Room;
module.exports.GameRoom = GameRoom;