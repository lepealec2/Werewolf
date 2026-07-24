console.log("SOCKET.JS LOADED");


const players = require("./players");
const gameModule = require("./game");

module.exports = function(io){
    io.on("connection", socket=>{
        console.log("Connected:", socket.id);
        socket.emit("players", []);
        socket.emit("lobbies", players.getLobbies());
        socket.on("login", username=>players.login(socket, username, io));
        socket.on("joinLobby", lobbyId=>players.joinLobby(socket, lobbyId, io));
        socket.on("leaveLobby", ()=>players.leaveLobby(socket, io));
        socket.on("updateLobbySettings",settings=>{players.updateLobbySettings(socket,settings,io);});
        socket.on("createGame", lobbyName=>{
            let player = players.getPlayer(socket.id);
            let id = players.createGameId(lobbyName, player ? player.username : "unknown");
            if(!id){
                socket.emit("gameError","Lobby name already exists");
                return;
            }
            if(player)
                players.joinLobby(socket, id, io);
            socket.emit("gameCreated", id);
            io.emit("lobbies", players.getLobbies());
        });
        // Chat is not currently implemented; ignore chat events to prevent server errors.
        socket.on("chat", msg=>{
            console.log("Chat event received but not implemented:", msg);
        });
        socket.on("disconnect", ()=>{
            console.log("Disconnected:", socket.id);
            players.disconnect(socket, io);
        });
        socket.on("startGame",()=>{
            let player=players.getPlayer(socket.id);
            let result=players.startGame(player.lobbyId,player.username,io);
            if(!result.success) socket.emit("gameError",result.message);
        });
        socket.on("moveToBuilding",building=>players.movePlayer(socket,building,io));
        socket.on("werewolfKill",target=>players.submitWerewolfKill(socket,target,io));
        socket.on("seerInvestigate",targets=>players.submitSeerInvestigation(socket,targets,io));
        socket.on("soldierProtect",target=>players.submitSoldierProtection(socket,target,io));
        socket.on("nightVoteDayTime",value=>players.submitNightDayTimeVote(socket,value,io));
        socket.on("nightVoteNominationLimit",value=>players.submitNightNominationLimitVote(socket,value,io));
        socket.on("executionVote",target=>players.submitExecutionVote(socket,target,io));
        socket.on("submitPhaseReady",()=>players.submitPhaseReady(socket,io));
        socket.on("forceAdvancePhase",()=>players.forceAdvancePhase(socket,io));
    });
};
