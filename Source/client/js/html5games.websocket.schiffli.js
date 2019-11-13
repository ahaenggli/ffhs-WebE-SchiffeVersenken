// Globale Variablen
var schiffliVars = {
	// Message-Typen
	CHAT_MESSAGE : 100,
	CHAT_ROOM : 101,
	GAME_LOGIC : 200,

	// Details fürs Game
	
	isPlayRoom : 0,
	WAITING_TO_START : 0,
	GAME_sendSchiffe: 201,
	GAME_versenkeSchiffe: 202,

	GAME_START : 1,
	GAME_OVER : 2,
	GAME_RESTART : 3,	
	

	isPlayerTurn : false,
	cntRunde     : 1
}

// init script when the DOM is ready.
$(function(){

function createGrid() {

size = 10 + schiffliVars.cntRunde-1;	
gegner = $('.drop-target-gegner');
ich    = $('.drop-target-ich');


for (var x = 65; x < 65+size; x++) {


	if(x == 65){
		for(var y = 0; y <= size; y++){
			gegner.append('<div class="SchiffFeld">'+ (y>0? y:'') +'</div>');
		}
		gegner.append('<br>');
	}
	
	gegner.append('<div class="SchiffFeld">'+String.fromCharCode(x)+'</div>');

	for(var y = 1; y <= size; y++){
		gegner.append('<button id="g' + String.fromCharCode(x) + '' + y + '" class="SchiffFeld SchiffFeldGegner">' + String.fromCharCode(x) + '' + y + '</button>');

		$('#g' + String.fromCharCode(x) + '' + y + '').on("click", function(){ if(schiffliVars.isPlayerTurn == true) {

			var data = {};
			data.dataType = schiffliVars.GAME_LOGIC;
			data.gameState = schiffliVars.GAME_versenkeSchiffe;	
			data.message = String.fromCharCode(x) + '' + y + '';	
			schiffliVars.socket.send(JSON.stringify(data));		

		} });

	}

	gegner.append('<br>');

}


for (var x = 65; x < 65+size; x++) {
	
	if(x == 65){
		for(var y = 0; y <= size; y++){
			ich.append('<div class="SchiffFeld">'+ (y>0? y:'') +'</div>');
		}
		ich.append('<br>');
	}
	
	ich.append('<div class="SchiffFeld">'+String.fromCharCode(x)+'</div>');

	for(var y = 1; y <= size; y++){
		ich.append('<input type="checkbox" name="' + String.fromCharCode(x) + '' + y + '" class="SchiffFeld meinFeld" />');
	}

	ich.append('<br>');
}

}

createGrid();

	// check if existence of WebSockets in browser
	if (window["WebSocket"]) {

		// create connection
		schiffliVars.socket = new WebSocket("ws://localhost:8000");

		// on open event
		schiffliVars.socket.onopen = function(e) {
			console.log('WebSocket connection established.');
		};

		// on message event
		schiffliVars.socket.onmessage = function(e) {
			// check if the received data is chat message or line segment
			console.log("onmessage event:",e.data);
			var data = JSON.parse(e.data);
			if (data.dataType === schiffliVars.CHAT_MESSAGE)
			{
				$("#chat-history").append("<li>"+data.sender+" said: "+data.message+"</li>");
			}
			else if (data.dataType === schiffliVars.CHAT_ROOM)
			{
				var dta = JSON.parse(data.message);

				if($("#myRaum").html() != dta.roomName)	$("#chat-history").html("");
				$("#myRaum").html(dta.roomName);
				$("#chat-userlist").html("");
				dta.userList.sort();
				dta.userList.forEach(u => { 
					$("#chat-userlist").append("<li>["+u.Username+"]</li>");
				});

				schiffliVars.isPlayRoom = dta.isPlayRoom;
				console.log("PR: "+dta.isPlayRoom);

			}
			else if (data.dataType === schiffliVars.GAME_LOGIC){
				//var dta = JSON.parse(data.message);
				schiffliVars.isPlayerTurn = data.isPlayerTurn
				
			}
			
			
			/* Kosmetik */
			var d = $('#chat-history');
			d.scrollTop(d.prop("scrollHeight"));

			if(schiffliVars.isPlayRoom == 0) $("#playZone").hide();
			else $("#playZone").show("slow");

			if(schiffliVars.isPlayerTurn) $("#drop-target-gegner button").attr("disabled", false);
			else $("#drop-target-gegner button").attr("disabled", true);

		};

		// on close event
		schiffliVars.socket.onclose = function(e) {
			console.log('WebSocket connection closed.');
		};
	}

	$("#send").click(sendMessage);
	$("#festlegen").click(festlegen);

	$("#chat-input").keypress(function(event) {
		if (event.keyCode === 13) {
			sendMessage();
		}
	});


 });



function festlegen(){
	console.log("festlegen");
		// pack the message into an object.
		var data = {};
		data.dataType = schiffliVars.GAME_LOGIC;
		data.gameState = schiffliVars.GAME_sendSchiffe;

		data.message = "";

		$('input.meinFeld:checkbox:checked').each(function () {
			data.message += $(this).attr("name") + '|';
		});
	
		schiffliVars.socket.send(JSON.stringify(data));
		$("#drop-target-ich input:checkbox").attr("disabled", true);
		$("#festlegen").attr("disabled", true);

}

function sendMessage()
{
	var message = $("#chat-input").val();

	// pack the message into an object.
	var data = {};
	data.dataType = schiffliVars.CHAT_MESSAGE;
	data.message = message;

	schiffliVars.socket.send(JSON.stringify(data));
	$("#chat-input").val("");
}





