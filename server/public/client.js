//client js
let currentUsername=null;
let currentLobby=null;
let myRole=null;




console.log("client.JS LOADED");
const socket = io();

console.log("SOCKET CREATED");

socket.on("connect",()=>{

    console.log(
        "CLIENT CONNECTED:",
        socket.id
    );

});



socket.on(
	"hostChanged",
	(data)=>{

		isHost =
			data.newHost === currentUsername;

		let btn =
			document.getElementById(
				"pauseTimerBtn"
			);

		if(btn){
			btn.style.display =
				isHost
				? "inline"
				: "none";
		}

		updateUserInfo();
		updateDebug();
	}
);

function voteTimer(value){
	socket.emit(
		"submitVote",
		{
			type:"dayTime",
			value:value
		}
	);
}


function submitNominationLimitVote(){

	let value =
		document.getElementById(
			"nominationLimitVote"
		).value;

	socket.emit(
		"submitVote",
		{
			type:"nominationLimit",
			value:parseInt(value)
		}
	);
}


socket.on(
	"settingsChanged",
	(settings)=>{

		console.log(
			"Settings updated:",
			settings
		);

	}
);


socket.on(
	"gameOver",
	(data)=>{

		alert(
			"Game Over! Winner: " +
			data.winner
		);

	}
);


socket.on(
	"nightResults",
	(data)=>{

		let msg =
			"Night Results:\n";


		if(data.killed){
			msg +=
				data.killed +
				" was killed!\n";
		}
		else{
			msg +=
				"No one was killed.\n";
		}


		if(data.destroyed){
			msg +=
				data.destroyed +
				" was destroyed!\n";
		}


		if(data.lost &&
		   data.lost.length > 0){

			msg +=
				"Lost in forest: " +
				data.lost.join(", ") +
				"\n";
		}


		alert(msg);

	}
);
function testLogin(){

    console.log("BUTTON WORKS");

}

function login(){

    console.log("LOGIN BUTTON CLICKED");

    let username =
        document.getElementById("username").value.trim();

    console.log("USERNAME:", username);

    socket.emit(
        "login",
        username
    );

}
document
.getElementById("loginBtn")
.addEventListener(
    "click",
    login
);

function createGame(){
	let lobbyName =document.getElementById("lobbyName").value.trim()||"abc";
    console.log("CREATE GAME CLICKED:",lobbyName);
    socket.emit("createGame",lobbyName);
}
socket.on("gameCreated",(id)=>{console.log("GAME CREATED:",id);});




socket.on(
    "joinedLobby",
    (lobbyId)=>{

        currentLobby = lobbyId;

        updateUserInfo();
    }
);

socket.on(
    "leftLobby",
    ()=>{

        currentLobby = null;

        updateUserInfo();
    }
);

function updateUserInfo(){

    document.getElementById("userInfo").innerText =
        "You are user \"" +
        currentUsername +
        "\"";


    let lobbyText =
        "Not in a lobby";


    if(currentLobby){

        lobbyText =
            "In lobby [" +
            currentLobby +
            "]";

    }


    document.getElementById(
        "currentLobbyStatus"
    ).innerText = lobbyText;

};







socket.on(
    "loginSuccess",
    data=>{
        console.log("LOGIN SUCCESS RECEIVED:",data);
        currentUsername =    data.username;
		currentLobby =data.lobbyId;
        let msg =
            "1) You are user \"" +currentUsername +"\"";
        if(currentLobby){
			msg +=" 2) and in lobby " +currentLobby;
        }
        else{
            msg +=" 3) and not in a lobby ";
		}
        document.getElementById("userInfo").innerHTML = msg;
        document.getElementById(
            "currentLobbyStatus"
        ).innerHTML =
            currentLobby
            ? "In lobby [" + currentLobby + "]"
            : "Not in a lobby";
    }
);

socket.on(
    "joinSuccess",
    lobbyId=>{
        console.log(
            "JOIN SUCCESS:",
            lobbyId
        );
	currentLobby=lobbyId;
        updateUserInfo();
    }
);


socket.on("leftLobby",()=>{currentLobby = null;updateUserInfo();});
socket.on("joinSuccess",(lobbyId)=>{console.log("JOIN SUCCESS:",lobbyId);currentLobby = lobbyId;updateUserInfo();});
socket.on("lobbySettingsUpdated", data => {document.getElementById("buildingCount").value = data.buildingCount;document.getElementById("dayTime").value = data.initialDayTime;});
socket.on("lobbies",lobbies=>{
    let list=document.getElementById("lobbies");
    list.innerHTML="";
    lobbies.forEach(l=>{
        let li=document.createElement("li");
        li.innerHTML=`Lobby: ${l.id} | Host: ${l.host} | Players: ${l.playerCount} [${l.playerNames.join(", ")}]`;
        list.appendChild(li);
    });
	let lobby=lobbies.find(x=>x.id===currentLobby);
	let isHost =lobby &&lobby.host===currentUsername;
    document.getElementById("hostSetup").style.display = isHost ? "block" : "none";
    document.getElementById("startGameBtn").style.display =isHost ? "block" : "none";
});
socket.on("gameError",msg=>alert(msg));

function updateSettings(){
    socket.emit("updateLobbySettings",{
        buildingCount:document.getElementById("buildingCount").value,
        initialDayTime:document.getElementById("dayTime").value
    });
}


document.getElementById("buildingCount").addEventListener("change",updateSettings);
document.getElementById("dayTime").addEventListener("change",updateSettings);
function startGame(){
    socket.emit("startGame");
}
document.getElementById("startGameBtn").addEventListener("click",()=>{socket.emit("startGame");});
socket.on("gameStarted",data=>{
    console.log("Game started:",data);
    let role=document.getElementById("playerRole");
    if(!role){
        role=document.createElement("div");
        role.id="playerRole";
        document.body.appendChild(role);
    }
	console.log("ROLE DISPLAY:",data.role);
    role.innerHTML="Your role: "+data.role;
});