// players.js
console.log("players.JS LOADED");
let players = {};
let accounts = {};
let games = {};
const gameModule = require("./game");
function login(socket,username,io){
    console.log("LOGIN START:",socket.id,username);
    username=username.trim();
    if(username===""){
        socket.emit("loginError","Username required");
        return;
    }
    let existing=accounts[username];
    if(existing){
        existing.socketId=socket.id;
        existing.online=true;
        players[socket.id]=existing;
        if(existing.lobbyId)
            joinLobby(socket,existing.lobbyId,io);
        socket.emit("loginSuccess",{username:existing.username,lobbyId:existing.lobbyId});
        io.emit("players",Object.values(accounts));
        io.emit("lobbies",getLobbies());
        return;
    }
    accounts[username]={
        username,
        socketId:socket.id,
        online:true,
        lobbyId:null
    };
    players[socket.id]=accounts[username];
    let lobbyId=null;
    let available=Object.values(games);
    if(available.length){
        let latestLobby=available.sort((a,b)=>b.createdAt-a.createdAt)[0];
        lobbyId=latestLobby.id;
        joinLobby(socket,lobbyId,io);
    }
    io.emit("players",Object.values(accounts));
    io.emit("lobbies",getLobbies());
    socket.emit("loginSuccess",{username,lobbyId});
}
function getPlayer(socketId){
    return players[socketId];
}
function removeAll(io){
    accounts={};
    players={};
    gameModule.resetAllGames();
    io.emit("players",[]);
    io.emit("lobbies",[]);
}
function disconnect(socket,io){
    let player =
        players[socket.id];
    if(player){
        player.online=false;
        player.socketId=null;
        if(player.lobbyId &&
           games[player.lobbyId]){
            let lobby =
                games[player.lobbyId];
            let index =
                lobby.players.indexOf(
                    player.username
                );
            if(index>-1){
                lobby.players.splice(index,1);
            }
            if(lobby.currentHost===player.username){
                let newHost =
                    lobby.players.length
                    ? lobby.players[0]
                    : lobby.originalHost;
                lobby.currentHost=newHost;
                io.to(player.lobbyId)
                .emit(
                    "hostChanged",
                    {newHost}
                );
            }
        }
        delete players[socket.id];
    }
    io.emit(
        "players",
        Object.values(accounts)
    );
    io.emit(
        "lobbies",
        getLobbies()
    );
}
function createGameId(lobbyName,creator){
    let id =lobbyName.trim().toUpperCase();
    if(games[id]){
        return null;
    }
    games[id]={
        id,
        createdAt:new Date(),
        players:[],
        originalHost:creator,
        currentHost:creator,
        buildingCount:5,
        initialDayTime:1,
        initialNightTime:1,
        settings:{
            discussionTime:3,
            nominationLimit:1,
            secondingTime:1
        },
        settingVotes:{
            discussionTime:{},
            nominationLimit:{},
            secondingTime:{}
        }
    };
    return id;
}
function getLobbies(){
    return Object.values(games)
    .map(lobby=>{
        let onlinePlayers=[];
        lobby.players.forEach(username=>{
            if(accounts[username] &&
               accounts[username].online &&
               accounts[username].lobbyId===lobby.id){
                onlinePlayers.push(username);
            }
        });
        return {
            ...lobby,
            playerCount:
                onlinePlayers.length,
            playerNames:
                onlinePlayers,
            host:
                lobby.currentHost || "Unknown"
        };
    });
}
function joinLobby(socket,lobbyId,io){
    let player=players[socket.id];
    if(!player){
        socket.emit("joinError","Not logged in");
        return;
    }
    if(!games[lobbyId]){
        socket.emit("joinError","Lobby does not exist");
        return;
    }
    if(player.lobbyId &&
       games[player.lobbyId]){
        let old =
            games[player.lobbyId];
        let index =old.players.indexOf(player.username);
        if(index>-1){
            old.players.splice(index,1);
        }
    }
    let lobby=games[lobbyId];
    player.lobbyId=lobbyId;
    if(!lobby.players.includes(player.username)){
        lobby.players.push(player.username);
    }
    if(lobby.originalHost==="unknown"){
        lobby.originalHost=player.username;
        lobby.currentHost=player.username;
    }
    io.emit("players",Object.values(accounts));
    io.emit("players",Object.values(accounts));
    io.emit("lobbies",getLobbies());
    socket.emit("joinSuccess",lobbyId);
}
function leaveLobby(socket,io){
    let player=players[socket.id];
    if(!player){
        return;
    }
    if(player.lobbyId &&
       games[player.lobbyId]){
        let lobby=
            games[player.lobbyId];
        let index=
            lobby.players.indexOf(
                player.username
            );
        if(index>-1){
            lobby.players.splice(index,1);
        }
    }
    player.lobbyId=null;
    io.emit(
        "players",
        Object.values(accounts)
    );
    io.emit(
        "lobbies",
        getLobbies()
    );
    socket.emit("leaveSuccess");
}
function startGame(lobbyId,username,io){
    let lobby=games[lobbyId];
    if(!lobby)
        return {
            success:false,
            message:"Lobby not found"
        };
    if(lobby.gameStarted)
        return {
            success:false,
            message:"Game Started!"
        };
    if(lobby.currentHost!==username)
        return {
            success:false,
            message:"Only host can start"
        };
    if(lobby.players.length<3)
        return {
            success:false,
            message:"Need at least 3 players"
        };
    if(lobby.players.length>12)
        return {
            success:false,
            message:"Maximum 12 players"
        };
    let gameInstance=gameModule.initializeGame(
        lobbyId,
        lobby.players,
        lobby.buildingCount,
        lobby.initialDayTime
    );
    console.log("START ROLES:",gameInstance.players);
    lobby.gameStarted=true;
    lobby.gameInstance=gameInstance;
    Object.values(gameInstance.players).forEach(p=>{
        let account=Object.values(accounts).find(a=>a.username===p.username);
        console.log(p.username,account);
        if(account)
            io.to(account.socketId).emit("gameStarted",{
                phase:gameInstance.phase,
                day:gameInstance.day,
                buildings:gameInstance.buildings,
                initialDayTime:lobby.initialDayTime,
                initialNightTime:lobby.initialNightTime
            });
    });
    Object.values(gameInstance.players).forEach(p=>{
        let account=Object.values(accounts).find(a=>a.username===p.username);
        if(account)
            io.to(account.socketId).emit("yourRole",p.role);
    });
    return {success:true};
}
function checkGameStart(lobbyId,io){
    let lobby=games[lobbyId];
    if(!lobby || lobby.gameStarted)
        return;
    io.to(lobbyId).emit("canStartGame",{
            canStart:
                lobby.players.length>=3 &&
                lobby.players.length<=12,
            host:lobby.currentHost
        }
    );
}
function submitWerewolfKill(socket,target,io){
    let player=players[socket.id];
    if(!player || !player.lobbyId)
        return;
    let game =
        games[player.lobbyId]
        ?.gameInstance;
    if(!game){
        socket.emit(
            "actionError",
            "Game not started"
        );
        return;
    }
    let wolf =
        game.players[player.username];
    if(wolf.role!==gameModule.ROLES.WEREWOLF){
        socket.emit(
            "actionError",
            "Not werewolf"
        );
        return;
    }
    let victim =
        game.players[target];
    if(!victim ||
       !victim.alive){
        socket.emit(
            "actionError",
            "Invalid target"
        );
        return;
    }
    if(wolf.location!==victim.location){
        socket.emit(
            "actionError",
            "Target must be in same building"
        );
        return;
    }
    game.werewolfKills.push(target);
    io.to(player.lobbyId)
    .emit(
        "werewolfKillSubmitted",
        {
            killer:player.username,
            target
        }
    );
}
function submitSeerInvestigation(socket,targets,io){
    let player=players[socket.id];
    let game=
        games[player.lobbyId]
        ?.gameInstance;
    if(!game)
        return;
    if(!Array.isArray(targets) ||
       targets.length!==2){
        socket.emit(
            "actionError",
            "Select two players"
        );
        return;
    }
    if(targets.includes(player.username)){
        socket.emit(
            "actionError",
            "Cannot target yourself"
        );
        return;
    }
    game.seerInvestigation=targets;
    socket.emit(
        "seerInvestigationSubmitted",
        {targets}
    );
}
function resolveSeer(game){
    return game.seerInvestigation
    .some(player=>
        game.players[player].role===
        gameModule.ROLES.WEREWOLF
    );
}
function checkWin(game){
    let alive =
        Object.values(game.players)
        .filter(p=>p.alive);
    let wolves =
        alive.filter(
            p=>p.role===
            gameModule.ROLES.WEREWOLF
        );
    if(wolves.length===0)
        return "villagers";
    if(wolves.length>=alive.length/2)
        return "werewolves";
    return null;
}
function destroyBuilding(game){
    let active =
        Object.keys(game.buildings)
        .filter(
            b=>!game.buildings[b].destroyed
        );
    let min =
        Math.min(
            ...active.map(
                b=>game.buildings[b].players.length
            )
        );
    let choices =
        active.filter(
            b=>game.buildings[b].players.length===min
        );
    let destroyed =
        choices[
            Math.floor(Math.random()*choices.length)
        ];
    game.buildings[destroyed].destroyed=true;
    return destroyed;
}
function updateLobbySettings(socket,settings,io){
    let player=players[socket.id];
    if(!player || !player.lobbyId) return;
    let lobby=games[player.lobbyId];
    if(lobby.currentHost!==player.username) return;
    lobby.buildingCount=parseInt(settings.buildingCount);
    lobby.initialDayTime=parseInt(settings.initialDayTime);
    io.emit("lobbySettingsUpdated",{buildingCount:lobby.buildingCount,initialDayTime:lobby.initialDayTime});
}
module.exports={login,getPlayer,removeAll,disconnect,createGameId,getLobbies,joinLobby,leaveLobby,startGame,checkGameStart,submitWerewolfKill,submitSeerInvestigation,resolveSeer,destroyBuilding,checkWin,updateLobbySettings};
