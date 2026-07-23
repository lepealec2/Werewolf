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
        socket.on("chat", msg=>chat.send(socket, io, msg));
        socket.on("disconnect", ()=>{
            console.log("Disconnected:", socket.id);
            players.disconnect(socket, io);});
    socket.on("startGame",()=>{let player=players.getPlayer(socket.id);let result=players.startGame(player.lobbyId,player.username,io);if(!result.success)socket.emit("gameError",result.message);});
    socket.on("yourRole",role=>{
    myRole=role;
    let el=document.getElementById("playerRole");
    if(el){
        el.innerHTML="Your role: "+role;
        el.style.display="block";
    }
});
});
};
