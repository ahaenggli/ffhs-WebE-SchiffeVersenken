// Globale Status-Variablen/Konstanten
var schiffliVars = {

	// Message-Typen (Massage wäre zwar angenehmer)
	CHAT_MESSAGE : 100,
	CHAT_ROOM : 101,
	GAME_LOGIC : 200,

	// Details zu Message-Typen
	WAITING_TO_START : 0,
	GAME_sendSchiffe: 201,
	GAME_versenkeSchiffe: 202,
	GAME_Wasser : 203,
	GAME_Treffer: 204,
	GAME_START : 1,
	GAME_RESTART : 3,
	GAME_ShipNotValid : 205,

	// Status zu Raum ond Spiel
	isPlayRoom : 0,
	isPlayerTurn : false,
	cntRunde     : 1
}

// Texte (mehrsprachigkeit)
var Texte = {};

var Texte_CH = {
	lblTitel: "Schiffli versenken - das online Game #1 (CH)",
	lblRaum : "Ruum",
	lblBenutzerliste: "Benotzerlistä",
	lblKommando: "Kommandos",
	lblKdoNick: "Wächslet din Name im Speli",
	lblKdoPlay: "Startet es Speli metem gwählte Gägner",
	lblKdoQuit: "Zrogg zor Lobby",
	lblRunde: "Rondi",
	lblBtnSend: "verschecke",
	lblGegner: "Gägner",
	lblIch: "Ich",
	lblBtnFestlegen: "Schiffli setze",
	GAME_ShipNotValid : "Duen doch dini Schiffli noch de Spielregle platziere!",
	GAME_schiffeLeer : "Tue doch bitte zersch es Schiffli platziere!"
};
var Texte_DE = {
	lblTitel: "Schiffli versenken - das online Game #1 (DE)",
	lblRaum : "Raum",
	lblKdoNick: "Wechselt den Username",
	lblKdoPlay: "Eroeffnet ein Spiel mit [username]",
	lblKdoQuit: "Retour zur Lobby",
	lblRunde: "Runde",
	lblBtnSend: "senden",
	lblGegner: "Gegner",
	lblIch: "Du",
	lblBtnFestlegen: "Schiffe festlegen",
	GAME_ShipNotValid : "Schiffe sind nicht gemäss Spielregeln platziert. Korrigiere das um spielen du dürfen.",
	GAME_schiffeLeer : "Bitte Schiffe setzen."
};



// init script erst wenn DOM bereit
$(function(){

// Sprache wählen
function spracheSetzen(){

	if($('#Sprache').val() == 'CH')	Texte = Texte_CH;
	if($('#Sprache').val() == 'DE')	Texte = Texte_DE;

	// zuerst alles für die Default-Sprache CH setzen, danach für gewählte (so steht in jedem Element auch was drin)
	// CH ist so quasi Fallback-Wert

	for(k in Texte_CH){
		// Alle Labels setzen! ID von Label stimmt mit Wert in Key/Value-Paar überein
		if(k.startsWith('lbl')){
			$('#'+k).html(Texte[k]);
		}
	}

	// jetzt für die gewählte Sprache
	for(k in Texte){
		// Alle Labels setzen! ID von Label stimmt mit Wert in Key/Value-Paar überein
		if(k.startsWith('lbl')){
			$('#'+k).html(Texte[k]);
		}
	}
};

// Initial-Sprache wird nun gesetzt
spracheSetzen();

// Ab nun kann Sprache geändert werden mit der Select-Box oben rechts
$('#Sprache').change(function(){
	spracheSetzen();
});


/* Kosmetik */
// immer gescrollt in Chat
var d = $('#chat-history');
d.scrollTop(d.prop("scrollHeight"));
// Runde nachgeführt
$('#runde').html(schiffliVars.cntRunde);
// PlayZone nur sichtbar während Spiel
if(schiffliVars.isPlayRoom == 0) $(".playZone").hide();
else $(".playZone").show("slow");

// Bei Klick auf Senden-Button, Nachricht an Server senden (versuchen)
$("#send").click(sendMessage);

// Bei Enter-Taste bei Tippen der Chat-Nachricht, das Senden auslösen
$("#chat-input").keypress(function(event) {
	if (event.keyCode === 13) {
		sendMessage();
	}
});

// Klick auf "Festlegen"-Button (Schiffe sind platzier)
$("#festlegen").click(festlegen);

	// Kann der Browser Sockets nutzen?
	if (window["WebSocket"]) {

		// Verbindung mit Server herstellen
		schiffliVars.socket = new WebSocket("ws://localhost:8000");

		// Event öffnen
		schiffliVars.socket.onopen = function(e) {
			console.log('WebSocket connection established.');
			// Grid malen mit Spielfeldgrösse 10x10
			createGrid();
		};

		// Servernachricht kommt via Socket rein
		schiffliVars.socket.onmessage = function(e) {

			// Erhaltene Daten parsen und entscheiden, was für ein Typ es ist
			// je nach Typ, entsprechende Logik abarbeiten
			console.log("onmessage event:",e.data);
			var data = JSON.parse(e.data);
			// Chat-Nachricht
			if (data.dataType === schiffliVars.CHAT_MESSAGE)
			{
				$("#chat-history").append("<li>"+data.sender+": "+data.message+"</li>");
			}
			// Raum-Veränderung
			else if (data.dataType === schiffliVars.CHAT_ROOM)
			{
				var dta = JSON.parse(data.message);
				// Chat leeren, falls Raum gewechselt
				if($("#myRaum").html() != dta.roomName)	$("#chat-history").html("");
				// Raum-Name setzen
				$("#myRaum").html(dta.roomName);
				// User nachführen
				$("#chat-userlist").html("");
				dta.userList.sort(); //alphabetisch
				dta.userList.forEach(u => {
					$("#chat-userlist").append("<li>["+u.Username+"]</li>");
				});
				// Spiele-Raum?
				schiffliVars.isPlayRoom = dta.isPlayRoom;
			}
			// Laufendes Spiel
			else if (data.dataType === schiffliVars.GAME_LOGIC){

				// Spiel gestartet, bin ich dran? Welche Runde haben wir?
				if(data.gameState === schiffliVars.GAME_START) {

					// platzieren von Schiffen temporär verbieten
					$("#drop-target-ich input:checkbox").attr("disabled", true);
					$("#festlegen").attr("disabled", true);

					schiffliVars.isPlayerTurn = data.isPlayerTurn;
					schiffliVars.cntRunde = data.newRunde;
					// Runde nachgeführt
					$('#runde').html(schiffliVars.cntRunde);
				}
				// Spiel neu gestartet, status auf initial-Werte zurücksetzen und Spielfeld neu zeichnen
				// bei neuer Runde wird auch das geliefert, Spielfeld könnte sich hiermit also vergrössern
				if(data.gameState === schiffliVars.GAME_RESTART) {
					schiffliVars.isPlayerTurn = false;
					$("#drop-target-ich input:checkbox").attr("disabled", false);
					$("#festlegen").attr("disabled", false);
					$('.SchiffFeld').css("background-color","white");
					schiffliVars.cntRunde = data.newRunde;
					// Runde nachgeführt
					$('#runde').html(schiffliVars.cntRunde);
					createGrid();
				}
				// Es wurde ein Boot getroffen!
				if(data.gameState === schiffliVars.GAME_Treffer){
					// Felder entsprechend rot einfärben (=Blut der Besatzung)
					$('#'+data.message).css("background-color","red");
					$('#'+data.message).css("border","1px solid red");

					var a = new Audio();
					a.src =   "./audio/Ship_Bell-Mike_Koenig-1911209136.mp3";
					a.play();

					console.log('#T'+data.message);
				}
				// Es wurde nur Wasser getroffen, alles i.O.
				if(data.gameState === schiffliVars.GAME_Wasser){
					// Felder blau Färben, nur Wasser
					$('#'+data.message).css("background-color","blue");
					$('#'+data.message).css("border","1px solid blue");

					var a = new Audio();
					a.src =   "./audio/Water Splash-SoundBible.com-800223477.mp3";
					a.play();

					console.log('#W'+data.message);
				}
				if(data.gameState === schiffliVars.GAME_ShipNotValid){
					alert(Texte.GAME_ShipNotValid);
				}
			} // GAME_LOGIC fertig

			/* Kann bei jeder Nachricht vom Server ändern, daher nochmals machen */
			// PlayZone nur sichtbar während Spiel
			if(schiffliVars.isPlayRoom == 0) $(".playZone").hide();
			else $(".playZone").show("slow");

			if(schiffliVars.isPlayerTurn) $("#drop-target-gegner button").attr("disabled", false);
			else $("#drop-target-gegner button").attr("disabled", true);


		};

		// Verbindung wurde geschlossen :(
		schiffliVars.socket.onclose = function(e) {
			console.log('WebSocket connection closed.');
		};
	}

 });

// Nachricht versenden
 function sendMessage()
 {
	 // getippte Nachricht laden
	 var message = $("#chat-input").val();

	 // in object verpacken
	 var data = {};
	 data.dataType = schiffliVars.CHAT_MESSAGE;
	 data.message = message;

	 // an Server senden, falls nicht leer
	 if(message != "") schiffliVars.socket.send(JSON.stringify(data));
	 // nachrichten-Feld wieder leeren
	 $("#chat-input").val("");
 }


// Schiffe sind platziert, an Server senden
function festlegen(){
		console.log("festlegen");
		// Päcklein für Server machen
		var data = {};
		data.dataType = schiffliVars.GAME_LOGIC;
		data.gameState = schiffliVars.GAME_sendSchiffe;

		// leere Nachricht initialisieren
		data.message = "";

		// Auswahl speichern in Nachricht mit Trennzeichen
		$('input.meinFeld:checkbox:checked').each(function () {
			data.message += $(this).attr("name") + '|';
		});

		// nur senden, wenn auch etwas ausgewählt, sonst verliert man ja gleich...
		if(data.message !== ""){
			if(areSchiffliValide(data.message)) schiffliVars.socket.send(JSON.stringify(data));
			else alert(Texte.GAME_ShipNotValid);
		}else{
			alert(Texte.GAME_schiffeLeer);
		}
}


// Spielfeder für Gegner & mich zeichen
// Achtung bei .append() - das doofe Teil schliesst offene HTML-Tags automatisch
// Daher die variable dynHTML verwendet. HTML-Code kommt da rein, danach wird alles via .append() geschrieben
function createGrid() {
	// grösse bestimmen
	size = 10 + schiffliVars.cntRunde-1;
	// 2 Spielfelder (des Gegners und eigenes)
	gegner = $('.drop-target-gegner');
	ich    = $('.drop-target-ich');

	// beides leeren (weil Aufruf evtl. Re-Init)
	gegner.empty();
	ich.empty();

	// A-? Durchgehen und INT als ASCII nutzen
	for (var x = 65; x < 65+size; x++) {
		// Wird sind bei A, somit überschrift der Zahlen 1-? machen
		if(x == 65){
			for(var y = 0; y <= size; y++){
				gegner.append('<div class="SchiffFeld">'+ (y>0? y:'') +'</div>');
			}
			gegner.append('<br>');
		}

		// Buchstabe am Rand schreiben
		gegner.append('<div class="SchiffFeld">'+String.fromCharCode(x)+'</div>');

		for(var y = 1; y <= size; y++){
			// Buttn schreiben
			gegner.append('<button id="g' + String.fromCharCode(x) + '' + y + '" class="SchiffFeld SchiffFeldGegner">' + String.fromCharCode(x) + '' + y + '</button>');
			// Den neuen Button mit Klick-Event versehen, damit auch was zum Server geht
			$('#g' + String.fromCharCode(x) + '' + y + '').on("click", function(){
				// nur senden, wenn ich an der Reihe bin
				if(schiffliVars.isPlayerTurn == true) {
					var data = {};
					data.dataType = schiffliVars.GAME_LOGIC;
					data.gameState = schiffliVars.GAME_versenkeSchiffe;
					data.message = this.id.substring(1);
					schiffliVars.socket.send(JSON.stringify(data));
			}
		});

		}

		gegner.append('<br>');

	}

	// .append() schliesst Tags, daher HTML mal hier rein schreiben und am Ende alles appenden
	var dynHTML = "";
	for (var x = 65; x < 65+size; x++) {

		// Bei Buchstabe A (ASCII)
		if(x == 65){
			dynHTML +=  ('<table><thead><tr>');
			for(var y = 0; y <= size; y++){
				dynHTML += ('<th class="SchiffFeld">'+ (y>0? y:'&nbsp;') +'</th>');
			}
			dynHTML += ('</thead></tr>');
		}

		dynHTML += ('<tr><td class="SchiffFeld">'+String.fromCharCode(x) +'</td>');

		for(var y = 1; y <= size; y++){
			dynHTML += ('<td class="SchiffFeld"><label class="box"> '+
						'<input id="ci' + String.fromCharCode(x) + '' + y + '" type="checkbox" name="' + String.fromCharCode(x) + '' + y + '" class="meinFeld" />'+
						'<span class="mark" id="i' + String.fromCharCode(x) + '' + y + '"></span> '+
						'</label></td>');
		}

		dynHTML += ('</tr>');
	}

	dynHTML += ('</table>');
	ich.append(dynHTML);
}



// sind Schiffe valide platziert?
function areSchiffliValide(strSchiffe){

	// undefined -> kann nicht valide sein
	if(strSchiffe == undefined) return false;

	// nichts gesetzt auch nicht
	if(strSchiffe.length <= 0) return false;

	// Anzahl genutze Boote-Felder != erlaubte Bootefelder
	if(strSchiffe.split('|').length-1 != (1*5 + 2*4 + 3*3 + 4*2) ) return false;

	// Spielfeld-Grösse
	var size = 10 + schiffliVars.cntRunde-1;

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