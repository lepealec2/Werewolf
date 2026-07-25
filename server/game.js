console.log("game.JS LOADED");
let games={};
const ROLES={WEREWOLF:"Werewolf",SEER:"Seer",SOLDER:"Soldier",VILLAGER:"Villager"};
const BUILDINGS={FOREST:"Forest",ARMORY:"Armory",BAKERY:"Bakery",CHAPEL:"Chapel",DOCKYARD:"Dockyard",ABBEY:"Abbey",BLACKSMITH:"Blacksmith",BARRACKS:"Barracks",DUNGEON:"Dungeon",DAM:"Dam"};
const PHASES={DAY:"Day",NIGHT:"Night"};
function getPowerRoleCount(n){
    if(n <= 5) return 1;
    if(n <= 7) return Math.random() < 0.5 ? 1 : 2;
    if(n <= 9) return Math.random() < 0.75 ? 2 : 1;
    return 2;
}
/* 
Players	Power           Roles	Reason
3–5	    Always          1	    A second power role makes the town too informed
6–7	    50% chance of   2   	Enough players for extra information without overwhelming wolves
8–9	    75% chance of   2	    Larger town needs more tools
10–12	Always          2	    Too many villagers without extra roles
Players	Wolves	Power Roles	Villagers
3   	1	    1   	    1
4   	1   	1   	    2
5   	1	    1	        3
6   	2	    1–2	        2–3
7	    2	    1–2	        3–4
8	    2	    mostly 2	4
9	    3	    mostly 2	4
10–12	3	    2	        5–7
*/
function getRoleConfig(n){
    const werewolves = n >= 9 ? 3 : (n >= 6 ? 2 : 1);
    const powerRoles = getPowerRoleCount(n);
    return {werewolves,powerRoles,villagers: n - werewolves - powerRoles};
}
function initializeGame(lobbyId,players,buildingCount=5){
    let config=getRoleConfig(players.length);
    if(!config) return null;
    let rolePool=[];
    for(let i=0;i<config.werewolves;i++) rolePool.push(ROLES.WEREWOLF);
    [ROLES.SEER,ROLES.SOLDER].sort(()=>Math.random()-0.5).slice(0,config.powerRoles).forEach(r=>rolePool.push(r));
    for(let i=0;i<config.villagers;i++) rolePool.push(ROLES.VILLAGER);
    rolePool.sort(()=>Math.random()-0.5);
    let gamePlayers={};
    players.forEach((u,i)=>{gamePlayers[u]={username:u,role:rolePool[i],alive:true,location:null,protected:false,lastProtected:null,lost:false};});
    console.log("GAME PLAYERS:",gamePlayers);
    let possible=[BUILDINGS.ARMORY,BUILDINGS.BAKERY,BUILDINGS.CHAPEL,BUILDINGS.DOCKYARD,BUILDINGS.ABBEY,BUILDINGS.BLACKSMITH,BUILDINGS.BARRACKS,BUILDINGS.DUNGEON,BUILDINGS.DAM].sort(()=>Math.random()-0.5);
    let selected=[BUILDINGS.FOREST,...possible.slice(0,Math.max(0,buildingCount-1))];
    games[lobbyId]={lobbyId,phase:PHASES.NIGHT,day:0,players:gamePlayers,buildings:{},destroyedBuildings:[],werewolfKills:[],seerInvestigation:null,solderProtection:null,lastSolderProtection:null,voting:{nominations:[],executionVotes:{},activeNomination:null},nightVotes:{nominationLimit:{}}};
    selected.forEach(b=>{games[lobbyId].buildings[b]={name:b,players:[],destroyed:false};});
    return games[lobbyId];
}
const getGame=id=>games[id];
const resetGame=id=>delete games[id];
const resetAllGames=()=>games={};
function advancePhase(id){
    let g=games[id];
    if(!g) return null;
    if(g.phase===PHASES.NIGHT){g.phase=PHASES.DAY;g.day++;}
    else{g.phase=PHASES.NIGHT;}
    return g.phase;
}
function processNightActions(id){
    let g=games[id];
    if(!g) return null;
    let result={killed:null,protected:null,investigated:null,lost:[],attackFailed:false};
    if(g.werewolfKills.length){
        let kills=[...new Set(g.werewolfKills)];
        let validKills=kills.filter(target=>canWerewolfAttackTarget(g,target));
        result.attackFailed = kills.length > 0 && validKills.length === 0;
        if(validKills.length){
            result.killed=validKills[Math.floor(Math.random()*validKills.length)];
        }
    }
    if(g.solderProtection){
        result.protected=g.solderProtection;
        result.protector = g.solderProtector || null;
        if(g.players[result.protected]) g.players[result.protected].protected=true;
        g.lastSolderProtection=g.solderProtection;
        g.lastSolderProtector=g.solderProtector || null;
    } else {
        g.lastSolderProtection=null;
    }
    if(g.seerInvestigation){
        result.investigated=g.seerInvestigation.map(t=>{
            let p=g.players[t];
            return {target:t,bad:p&&p.role===ROLES.WEREWOLF};
        });
    }
    if(result.killed&&g.players[result.killed]){
        let v=g.players[result.killed];
        if(!v.protected) v.alive=false;
        else result.killed=null;
    }
    Object.values(g.players).forEach(p=>p.protected=false);
    g.werewolfKills=[];
    g.solderProtection=null;
    g.solderProtector=null;
    g.seerInvestigation=null;
    return result;
}
function canWerewolfAttackTarget(game,target){
    let targetPlayer=game.players[target];
    if(!targetPlayer || !targetPlayer.alive || !targetPlayer.location) return false;
    return Object.values(game.players).some(p=>p.alive && p.role===ROLES.WEREWOLF && p.location===targetPlayer.location);
}
function processExecutionVotes(id){
    let g=games[id];
    if(!g||!g.voting.activeNomination) return null;
    let counts={};
    Object.values(g.voting.executionVotes).forEach(v=>counts[v]=(counts[v]||0)+1);
    let winner=null,highest=0;
    Object.keys(counts).forEach(p=>{if(counts[p]>highest){highest=counts[p];winner=p;}});
    let alive=Object.values(g.players).filter(p=>p.alive).length;
    if(highest<Math.ceil(alive/2)) winner=null;
    if(winner&&g.players[winner]) g.players[winner].alive=false;
    g.voting.executionVotes={};g.voting.activeNomination=null;
    return winner;
}
function processBuildingDestruction(id){
    let g=games[id];
    if(!g) return null;
    let available=Object.keys(g.buildings).filter(b=>!g.buildings[b].destroyed&&b!==BUILDINGS.FOREST);
    if(!available.length) return null;
    let min=Math.min(...available.map(b=>g.buildings[b].players.length));
    let choices=available.filter(b=>g.buildings[b].players.length===min);
    let destroyed=choices[Math.floor(Math.random()*choices.length)];
    g.buildings[destroyed].destroyed=true;
    g.destroyedBuildings.push(destroyed);
    return destroyed;
}
function checkWinCondition(lobbyId){
    let game=games[lobbyId];
    if(!game) return null;
    let alive=Object.values(game.players).filter(player=>player.alive);
    let wolves=alive.filter(player=>player.role===ROLES.WEREWOLF);
    let good=alive.filter(player=>player.role!==ROLES.WEREWOLF);
    if(wolves.length===0) return "villagers";
    if(wolves.length>=good.length) return "werewolves";
    return null;
}
function setPlayerLocation(lobbyId,username,building){
    let game=games[lobbyId];
    if(!game||  !game.players[username]||   !game.buildings[building])
        return false;
    let player=game.players[username];
    if(player.location){
        let old=game.buildings[player.location];
        if(old){ let index=old.players.indexOf(username);
            if(index>-1) old.players.splice(index,1);
        }
    }
    player.location=building;
    game.buildings[building].players.push(username);
    return true;
}
function canKill(lobbyId,wolf,target){
    let game=games[lobbyId];
    if(!game)
        return false;
    let wolfPlayer=game.players[wolf];
    let targetPlayer=game.players[target];
    if(!wolfPlayer||!targetPlayer||!wolfPlayer.location||!targetPlayer.location)
        return false;
    return wolfPlayer.alive && targetPlayer.alive && wolfPlayer.location===targetPlayer.location;
}
function getAlivePlayers(lobbyId){
    let game=games[lobbyId];
    if(!game)
        return [];
    return Object.values(game.players)
        .filter(player=>player.alive);
}
module.exports={ROLES,BUILDINGS,PHASES,getRoleConfig,initializeGame,getGame,resetGame,resetAllGames,advancePhase,processNightActions,processBuildingDestruction,processExecutionVotes,checkWinCondition,setPlayerLocation,canKill,getAlivePlayers};