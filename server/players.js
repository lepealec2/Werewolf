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
        initialDayTime:3,
        initialNightTime:1,
        // advanceThresholdType: 'percent'|'count', advanceThresholdValue: number
        advanceThresholdType: 'percent',
        advanceThresholdValue: 75,
        hostCanBypass: false,
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
        lobby.initialNightTime
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
                players:Object.values(gameInstance.players).map(player=>({
                    username:player.username,
                    alive:player.alive,
                    location:player.location
                })),
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
function resetPlayerLocations(game){
    Object.values(game.buildings).forEach(building=>{building.players=[];});
    Object.values(game.players).forEach(player=>{player.location=null;});
}
function assignRandomLocationsForDay(game){
    let available = Object.keys(game.buildings).filter(b=>!game.buildings[b].destroyed);
    let assigned=[];
    Object.values(game.players).forEach(player=>{
        if(!player.alive) return;
        if(player.location) return;
        if(!available.length) return;
        let building = available[Math.floor(Math.random()*available.length)];
        gameModule.setPlayerLocation(game.lobbyId, player.username, building);
        assigned.push({username:player.username,building});
    });
    return assigned;
}
function pickRandomValue(values){
    if(!values || !values.length) return null;
    return values[Math.floor(Math.random()*values.length)];
}
function getMostVotedValue(votes, defaultValue){
    if(!votes || Object.keys(votes).length===0){
        return defaultValue;
    }
    // legacy numeric-only support
    let entries = Object.entries(votes).map(([value,count])=>({value, count}));
    let maxCount = Math.max(...entries.map(e=>e.count));
    let topEntries = entries.filter(e=>e.count===maxCount).map(e=>e.value);
    if(topEntries.length===1){
        let v = topEntries[0];
        if(v === 'random') return 'random';
        return Number(v);
    }
    // tie: choose one of the top entries
    let chosen = pickRandomValue(topEntries);
    if(chosen === 'random') return 'random';
    return Number(chosen);
}

function resolveVoteChoice(votes, allowedValues, defaultValue){
    if(!votes || Object.keys(votes).length===0) return defaultValue;
    let entries = Object.entries(votes).map(([value,count])=>({value, count}));
    let maxCount = Math.max(...entries.map(e=>e.count));
    let topEntries = entries.filter(e=>e.count===maxCount).map(e=>e.value);
    let chosen = topEntries.length===1 ? topEntries[0] : pickRandomValue(topEntries);
    if(chosen === 'random') return pickRandomValue(allowedValues);
    return Number(chosen);
}
function processPhaseEnd(lobbyId,io){
    let lobby = games[lobbyId];
    if(!lobby || !lobby.gameInstance) return;
    let game = lobby.gameInstance;
    if(game.phase === gameModule.PHASES.NIGHT){
        let results = gameModule.processNightActions(lobbyId);
        let destroyed = gameModule.processBuildingDestruction(lobbyId);
        io.to(lobbyId).emit("nightResults",{...results, destroyed});
        let winner = gameModule.checkWinCondition(lobbyId);
        if(winner){
            io.to(lobbyId).emit("gameOver",{winner});
            return;
        }
        // If no night votes, pick random defaults
        let nextDayMinutes = resolveVoteChoice(game.nightVotes?.dayTime || {}, [1,3,5,10], pickRandomValue([1,3,5,10]));
        let nextNominationLimit = resolveVoteChoice(game.nightVotes?.nominationLimit || {}, [1,2,3,4,5], pickRandomValue([1,2,3,4,5]));
        game.nightVotes = {dayTime:{},nominationLimit:{}};
        let phase = gameModule.advancePhase(lobbyId,nextDayMinutes,lobby.initialNightTime);
        resetPlayerLocations(game);
        io.to(lobbyId).emit("phaseChanged",{
            phase,
            day:game.day,
            players:Object.values(game.players).map(player=>({username:player.username,alive:player.alive,location:player.location})),
            buildings:game.buildings,
            nextDayTime: nextDayMinutes,
            nominationLimit: nextNominationLimit
        });
        game.phaseReadySubmissions = new Set();
        let livingNow = Object.values(game.players).filter(p=>p.alive).length;
        let typeNow = lobby.advanceThresholdType || 'percent';
        let valueNow = lobby.advanceThresholdValue || 75;
        let requiredNow = typeNow === 'percent' ? Math.max(1, Math.ceil(livingNow * (valueNow/100))) : Math.min(Math.max(1, Number(valueNow)||1), livingNow);
        io.to(lobbyId).emit('phaseReadyUpdate',{count:0, required: requiredNow});
        return;
    }
    let executed = gameModule.processExecutionVotes(lobbyId);
    if(executed){
        io.to(lobbyId).emit("executionResult",{target:executed});
    }
    let winner = gameModule.checkWinCondition(lobbyId);
    if(winner){
        io.to(lobbyId).emit("gameOver",{winner});
        return;
    }
    let assigned = assignRandomLocationsForDay(game);
    assigned.forEach(a=>{
        io.to(lobbyId).emit("locationUpdated",{
            username:a.username,
            building:a.building,
            buildings:game.buildings
        });
    });
    let phase = gameModule.advancePhase(lobbyId,lobby.initialDayTime,lobby.initialNightTime);
    io.to(lobbyId).emit("phaseChanged",{
        phase,
        day:game.day,
        players:Object.values(game.players).map(player=>({username:player.username,alive:player.alive,location:player.location})),
        buildings:game.buildings
    });
    game.phaseReadySubmissions = new Set();
    let livingNow = Object.values(game.players).filter(p=>p.alive).length;
    let typeNow = lobby.advanceThresholdType || 'percent';
    let valueNow = lobby.advanceThresholdValue || 75;
    let requiredNow = typeNow === 'percent' ? Math.max(1, Math.ceil(livingNow * (valueNow/100))) : Math.min(Math.max(1, Number(valueNow)||1), livingNow);
    io.to(lobbyId).emit('phaseReadyUpdate',{count:0, required: requiredNow});
}

function submitNightVote(socket,type,value,io){
    let player = players[socket.id];
    if(!player || !player.lobbyId) return;
    let game = games[player.lobbyId]?.gameInstance;
    if(!game){
        socket.emit("actionError","Game not started");
        return;
    }
    if(game.phase !== gameModule.PHASES.NIGHT){
        socket.emit("actionError","Night votes allowed only during Night");
        return;
    }
    if(type!="dayTime" && type!="nominationLimit"){
        socket.emit("actionError","Invalid vote type");
        return;
    }
    // allow 'random' as a vote value or numeric minute/limit
    let voteKey = null;
    if(typeof value === 'string' && value === 'random'){
        voteKey = 'random';
    } else {
        let parsed = parseInt(value,10);
        if(isNaN(parsed) || parsed <= 0){
            socket.emit("actionError","Invalid vote value");
            return;
        }
        voteKey = String(parsed);
    }
    game.nightVotes = game.nightVotes || {dayTime:{},nominationLimit:{}};
    game.nightVotes[type][voteKey] = (game.nightVotes[type][voteKey] || 0) + 1;
    let counts = Object.fromEntries(Object.entries(game.nightVotes[type]).sort((a,b)=>{
        // keep 'random' last for numeric ordering
        if(a[0]==='random') return 1;
        if(b[0]==='random') return -1;
        return Number(a[0]) - Number(b[0]);
    }));
    io.to(player.lobbyId).emit("nightVoteUpdate",{type,counts});
}
function submitNightDayTimeVote(socket,value,io){
    return submitNightVote(socket,"dayTime",value,io);
}
function submitNightNominationLimitVote(socket,value,io){
    return submitNightVote(socket,"nominationLimit",value,io);
}

function submitPhaseReady(socket,io){
    let player = players[socket.id];
    if(!player || !player.lobbyId) return;
    let lobby = games[player.lobbyId];
    if(!lobby || !lobby.gameInstance) return;
    let game = lobby.gameInstance;
    game.phaseReadySubmissions = game.phaseReadySubmissions || new Set();
    if(game.phaseReadySubmissions.has(player.username)){
        socket.emit('actionError','Already submitted ready for this phase');
        return;
    }
    game.phaseReadySubmissions.add(player.username);
    let living = Object.values(game.players).filter(p=>p.alive).length;
    let type = lobby.advanceThresholdType || 'percent';
    let value = lobby.advanceThresholdValue || 75;
    let required = type === 'percent' ? Math.max(1, Math.ceil(living * (value/100))) : Math.min(Math.max(1, Number(value)||1), living);
    let count = game.phaseReadySubmissions.size;
    io.to(player.lobbyId).emit('phaseReadyUpdate',{count, required});
    if(count >= required){
        processPhaseEnd(player.lobbyId, io);
    }
}

function movePlayer(socket,building,io){
    let player=players[socket.id];
    if(!player || !player.lobbyId) return;
    let game=games[player.lobbyId]?.gameInstance;
    if(!game){
        socket.emit("actionError","Game not started");
        return;
    }
    if(game.phase!==gameModule.PHASES.NIGHT){
        socket.emit("actionError","Building selection allowed only during Night");
        return;
    }
    if(building==="random"){
        let possible = Object.keys(game.buildings).filter(b=>!game.buildings[b].destroyed);
        if(!possible.length){
            socket.emit("actionError","No valid buildings to move to");
            return;
        }
        building = possible[Math.floor(Math.random()*possible.length)];
    }
    if(game.buildings[building]?.destroyed){
        socket.emit("actionError","Cannot move to destroyed building");
        return;
    }
    let moved=gameModule.setPlayerLocation(player.lobbyId,player.username,building);
    if(!moved){
        socket.emit("actionError","Invalid building");
        return;
    }
    io.to(player.lobbyId).emit("locationUpdated",{
        username:player.username,
        building,
        buildings:game.buildings
    });
    socket.emit("moveSuccess",{building});
}
function submitSoldierProtection(socket,target,io){
    let player=players[socket.id];
    if(!player || !player.lobbyId) return;
    let game=games[player.lobbyId]?.gameInstance;
    if(!game){
        socket.emit("actionError","Game not started");
        return;
    }
    let solder = game.players[player.username];
    if(solder.role!==gameModule.ROLES.SOLDER){
        socket.emit("actionError","Not Soldier");
        return;
    }
    if(game.solderProtection){
        socket.emit("actionError","Solder protection already submitted for this night");
        // Return the existing protection result (protector + target) so client can display it
        let prevTarget = game.solderProtection;
        let protector = game.solderProtector || null;
        io.to(player.lobbyId).emit("solderProtectionSubmitted",{username:protector,target:prevTarget});
        return;
    }
    if(target==="random"){
        let possible = Object.values(game.players).filter(p=>p.alive && p.username!==player.username && p.username!==game.lastSolderProtection);
        if(!possible.length){
            socket.emit("actionError","No valid protection targets");
            return;
        }
        target = possible[Math.floor(Math.random()*possible.length)].username;
    }
    if(game.lastSolderProtection && target===game.lastSolderProtection){
        socket.emit("actionError","Cannot protect the same player two nights in a row");
        return;
    }
    if(!game.players[target] || !game.players[target].alive){
        socket.emit("actionError","Invalid target");
        return;
    }
    game.solderProtection=target;
    game.solderProtector = player.username;
    io.to(player.lobbyId).emit("solderProtectionSubmitted",{username:player.username,target});
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
    if(game.phase !== gameModule.PHASES.NIGHT){
        socket.emit(
            "actionError",
            "Werewolf attacks allowed only during Night"
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
    if(target==="none"){
        io.to(player.lobbyId)
        .emit(
            "werewolfKillSubmitted",
            {
                killer:player.username,
                target:"none"
            }
        );
        return;
    }
    if(target==="random"){
        let possible = Object.values(game.players).filter(p=>p.alive && p.username!==player.username);
        if(!possible.length){
            socket.emit("actionError","No valid random target");
            return;
        }
        target = possible[Math.floor(Math.random()*possible.length)].username;
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
    if(!player || !player.lobbyId) return;
    let game=
        games[player.lobbyId]
        ?.gameInstance;
    if(!game){
        socket.emit("actionError","Game not started");
        return;
    }
    let seer = game.players[player.username];
    if(!seer || seer.role!==gameModule.ROLES.SEER){
        socket.emit(
            "actionError",
            "Not Seer"
        );
        return;
    }
    if(game.phase !== gameModule.PHASES.NIGHT){
        socket.emit("actionError","Investigation allowed only during Night phase");
        return;
    }
    if(game.seerInvestigation){
        let previousTargets = game.seerInvestigation;
        let foundAny = previousTargets.some(t=>game.players[t]?.role===gameModule.ROLES.WEREWOLF);
        socket.emit("actionError","Investigation allowed only during Night phase");
        socket.emit("seerInvestigationResult",{targets:previousTargets,foundAny});
        return;
    }
    if(!Array.isArray(targets) || targets.length!==2){
        socket.emit("actionError","Select exactly two players");
        return;
    }
    let alivePlayers = Object.values(game.players)
        .filter(p=>p.alive)
        .map(p=>p.username);
    let chosen = [];
    for(let target of targets){
        if(target==="random"){
            chosen.push("random");
            continue;
        }
        if(!game.players[target] || !game.players[target].alive){
            socket.emit("actionError","Invalid target");
            return;
        }
        chosen.push(target);
    }
    if(chosen[0]!=="random" && chosen[1]!=="random" && chosen[0]===chosen[1]){
        socket.emit("actionError","Targets must be different");
        return;
    }
    let resolved = [];
    let remaining = [...alivePlayers];
    const pickRandom = exclude=>{
        let pool = remaining.filter(name => !exclude.includes(name));
        if(pool.length===0) return null;
        let index=Math.floor(Math.random()*pool.length);
        let choice=pool[index];
        remaining = remaining.filter(name=>name!==choice);
        return choice;
    };
    if(chosen[0]!=="random"){
        resolved.push(chosen[0]);
        remaining = remaining.filter(name=>name!==chosen[0]);
    }
    if(chosen[1]!=="random"){
        resolved.push(chosen[1]);
        remaining = remaining.filter(name=>name!==chosen[1]);
    }
    if(chosen[0]==="random" && chosen[1]==="random"){
        let first = pickRandom([]);
        let second = pickRandom([first]);
        if(!first || !second){
            socket.emit("actionError","Not enough players to investigate");
            return;
        }
        resolved = [first, second];
    } else if(chosen[0]==="random" || chosen[1]==="random"){
        let explicit = resolved[0];
        let randomTarget = pickRandom([explicit]);
        if(!randomTarget){
            socket.emit("actionError","Not enough players to investigate");
            return;
        }
        resolved = [explicit, randomTarget];
    }
    if(resolved.length!==2){
        socket.emit("actionError","Unable to resolve two targets");
        return;
    }
    let foundAny = resolved.some(t=>game.players[t].role===gameModule.ROLES.WEREWOLF);
    game.seerInvestigation = resolved;
    socket.emit("seerInvestigationSubmitted",{targets:resolved});
    socket.emit("seerInvestigationResult",{targets:resolved,foundAny});
}
function submitExecutionVote(socket,target,io){
    let player=players[socket.id];
    if(!player || !player.lobbyId)
        return;
    let game=games[player.lobbyId]?.gameInstance;
    if(!game){
        socket.emit("actionError","Game not started");
        return;
    }
    if(!game.players[target] || !game.players[target].alive){
        socket.emit("actionError","Invalid target");
        return;
    }
    if(game.voting.activeNomination && game.voting.activeNomination!==target){
        game.voting.executionVotes={};
    }
    game.voting.activeNomination=target;
    game.voting.executionVotes[player.username]=target;
    let counts={};
    Object.values(game.voting.executionVotes).forEach(v=>counts[v]=(counts[v]||0)+1);
    io.to(player.lobbyId).emit("executionVoteUpdate",{target,counts});
    let aliveCount=gameModule.getAlivePlayers(player.lobbyId).length;
    let votesFor=counts[target]||0;
    if(votesFor>=Math.ceil(aliveCount/2)){
        game.players[target].alive=false;
        game.voting.executionVotes={};
        game.voting.activeNomination=null;
        io.to(player.lobbyId).emit("executionResult",{target});
    }
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
    lobby.initialNightTime = parseInt(settings.initialNightTime) || lobby.initialNightTime;
    // apply advance threshold settings if provided
    if(typeof settings.advanceThresholdType !== 'undefined'){
        lobby.advanceThresholdType = settings.advanceThresholdType;
    }
    if(typeof settings.advanceThresholdValue !== 'undefined'){
        lobby.advanceThresholdValue = parseInt(settings.advanceThresholdValue) || lobby.advanceThresholdValue;
    }
    if(typeof settings.hostCanBypass !== 'undefined'){
        lobby.hostCanBypass = !!settings.hostCanBypass;
    }
    // include submission-based advancement settings
    io.emit("lobbySettingsUpdated",{buildingCount:lobby.buildingCount, initialNightTime: lobby.initialNightTime, advanceThresholdType: lobby.advanceThresholdType, advanceThresholdValue: lobby.advanceThresholdValue, hostCanBypass: !!lobby.hostCanBypass});
}


function forceAdvancePhase(socket,io){
    let player=players[socket.id];
    if(!player||!player.lobbyId) return;
    let lobby=games[player.lobbyId];
    if(!lobby) return;
    if(lobby.currentHost!==player.username){
        socket.emit('actionError','Only host can force advance');
        return;
    }
    if(!lobby.hostCanBypass){
        socket.emit('actionError','Host bypass not enabled for this lobby');
        return;
    }
    processPhaseEnd(player.lobbyId, io);
}
module.exports={login,getPlayer,removeAll,disconnect,createGameId,getLobbies,joinLobby,leaveLobby,startGame,checkGameStart,submitWerewolfKill,submitSeerInvestigation,submitSoldierProtection,submitNightDayTimeVote,submitNightNominationLimitVote,submitExecutionVote,submitPhaseReady,forceAdvancePhase,movePlayer,resolveSeer,destroyBuilding,checkWin,updateLobbySettings,submitPhaseReady};
 