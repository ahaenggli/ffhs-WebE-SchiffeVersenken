
var schiffliVars = {
	// Contants
	CHAT_MESSAGE : 100,
	CHAT_ROOM : 101,

	
	
	LINE_SEGMENT : 0,	
	GAME_LOGIC : 2,

	// Constant for game logic state
	isPlayRoom : 0,


	WAITING_TO_START : 0,
	GAME_START : 1,
	GAME_OVER : 2,
	GAME_RESTART : 3,

	// indictes if it is drawing now.
	isDrawing : false,

	isTurnToDraw : false,

	// the starting point of next line drawing.
	startX : 0,
	startY : 0,
}

// init script when the DOM is ready.
$(function(){


$(".drop-target").droppable({
	accept: ".drag-item",
});

$(".drag-item").draggable({
	snap: '.gridlines',
	stop: function(){
        $(this).draggable('option','revert','invalid');
    }
});



$('.drag-item').droppable(
	{
    greedy: true,
    tolerance: 'touch',
    drop: function(event,ui){
           ui.draggable.draggable('option','revert',true);
	     }
	}

);






function createGrid(size) {
var i,
sel = $('.drop-target'),
	height = sel.height(),
	width = sel.width(),
	ratioW = Math.floor(width / size),
	ratioH = Math.floor(height / size);

for (i = 0; i <= ratioW; i++) { // vertical grid lines
  $('<div />').css({
		'margin-top': 0,
		'margin-left': i * size,
		'width': 1,		
		'height': height
  })
	.addClass('gridlines')
	.appendTo(sel);
}

for (i = 0; i <= ratioH; i++) { // horizontal grid lines
  $('<div />').css({
		'margin-top': i * size,
		'margin-left': 0,
		'width': width,
		'height': 1
  })
	.addClass('gridlines')
	.appendTo(sel);
}

$('.gridlines').show();
}

createGrid(30);

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
			
			
			/* Kosmetik */
			var d = $('#chat-history');
			d.scrollTop(d.prop("scrollHeight"));

			if(schiffliVars.isPlayRoom == 0) $("#playZone").hide();
			else $("#playZone").show("slow");


		};

		// on close event
		schiffliVars.socket.onclose = function(e) {
			console.log('WebSocket connection closed.');
		};
	}

	$("#send").click(sendMessage);

	$("#chat-input").keypress(function(event) {
		if (event.keyCode === 13) {
			sendMessage();
		}
	});






 });





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





