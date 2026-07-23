console.log("game.JS LOADED");

let games={};

const ROLES={
    WEREWOLF:"werewolf",
    SEER:"seer",
    SOLDIER:"soldier",
    VILLAGER:"villager"
};

const BUILDINGS={
    FOREST:"forest",
    ARMORY:"armory",
    BAKERY:"bakery",
    CHAPEL:"chapel",
    DOCKYARD:"dockyard",
    ABBEY:"abbey",
    BLACKSMITH:"blacksmith",
    BARRACKS:"barracks",
    DUNGEON:"dungeon",
    DAM:"dam"
};

const PHASES={
    DAY:"day",
    NIGHT:"night"
};

function getRoleConfig(playerCount){
    if(playerCount>=3&&playerCount<=8)
        return {
            werewolves:1,
            powerRoles:1,
            villagers:playerCount-2
        };

    if(playerCount>=9&&playerCount<=12)
        return {
            werewolves:2,
            powerRoles:2,
            villagers:playerCount-4
        };

    return null;
}

function initializeGame(
    lobbyId,
    players,
    buildingCount=5,
    initialNightTime=1
){
    let config=getRoleConfig(players.length);

    if(!config)
        return null;

    let rolePool=[];

    for(let i=0;i<config.werewolves;i++)
        rolePool.push(ROLES.WEREWOLF);

    [ROLES.SEER,ROLES.SOLDIER]
    .sort(()=>Math.random()-0.5)
    .slice(0,config.powerRoles)
    .forEach(role=>rolePool.push(role));

    for(let i=0;i<config.villagers;i++)
        rolePool.push(ROLES.VILLAGER);

    rolePool.sort(()=>Math.random()-0.5);

    let gamePlayers={};

    players.forEach((username,index)=>{
        gamePlayers[username]={
            username,
            role:rolePool[index],
            alive:true,
            location:null,
            protected:false,
            lastProtected:null,
            lost:false
        };
    });
    console.log("GAME PLAYERS:",gamePlayers);
    let possibleBuildings=[
        BUILDINGS.ARMORY,
        BUILDINGS.BAKERY,
        BUILDINGS.CHAPEL,
        BUILDINGS.DOCKYARD,
        BUILDINGS.ABBEY,
        BUILDINGS.BLACKSMITH,
        BUILDINGS.BARRACKS,
        BUILDINGS.DUNGEON,
        BUILDINGS.DAM
    ];

    possibleBuildings.sort(()=>Math.random()-0.5);

    let selectedBuildings=[BUILDINGS.FOREST];

    selectedBuildings.push(
        ...possibleBuildings.slice(
            0,
            Math.max(0,buildingCount-1)
        )
    );

    games[lobbyId]={
        lobbyId,
        phase:PHASES.NIGHT,
        day:0,
        players:gamePlayers,
        buildings:{},
        destroyedBuildings:[],
        werewolfKills:[],
        seerInvestigation:null,
        soldierProtection:null,
        voting:{
            nominations:[],
            executionVotes:{},
            activeNomination:null,
            nominationTimer:null
        },
        phaseTimer:null,
        phaseStartTime:null,
        phaseDuration:initialNightTime*60,
        phasePaused:false,
        phasePausedAt:null
    };

    selectedBuildings.forEach(building=>{
        games[lobbyId].buildings[building]={
            name:building,
            players:[],
            destroyed:false
        };
    });

    return games[lobbyId];
}

function getGame(lobbyId){
    return games[lobbyId];
}

function resetGame(lobbyId){
    delete games[lobbyId];
}

function resetAllGames(){
    games={};
}

function advancePhase(lobbyId,initialDayTime=3,initialNightTime=1){

    let game=games[lobbyId];

    if(!game)
        return null;

    if(game.phaseTimer){
        clearTimeout(game.phaseTimer);
        game.phaseTimer=null;
    }

    game.phasePaused=false;
    game.phasePausedAt=null;

    if(game.phase===PHASES.NIGHT){
        game.phase=PHASES.DAY;
        game.day++;
        game.phaseDuration=initialDayTime*60;
    }
    else{
        game.phase=PHASES.NIGHT;
        game.phaseDuration=initialNightTime*60;
    }

    game.phaseStartTime=Date.now();

    return game.phase;
}


function processNightActions(lobbyId){

    let game=games[lobbyId];

    if(!game)
        return null;

    let result={
        killed:null,
        protected:null,
        investigated:null,
        lost:[]
    };


    if(game.werewolfKills.length){

        let kills=[...new Set(game.werewolfKills)];

        result.killed=
            kills[Math.floor(Math.random()*kills.length)];
    }


    if(game.soldierProtection){

        result.protected=game.soldierProtection;

        if(game.players[result.protected])
            game.players[result.protected].protected=true;
    }


    if(game.seerInvestigation){

        result.investigated=
            game.seerInvestigation.map(target=>{

                let player=game.players[target];

                return {
                    target,
                    bad:
                        player &&
                        player.role===ROLES.WEREWOLF
                };
            });
    }


    if(result.killed&&game.players[result.killed]){

        let victim=game.players[result.killed];

        if(!victim.protected)
            victim.alive=false;
        else
            result.killed=null;
    }


    Object.values(game.players)
    .forEach(player=>{
        player.protected=false;
    });


    game.werewolfKills=[];
    game.soldierProtection=null;
    game.seerInvestigation=null;

    return result;
}


function processExecutionVotes(lobbyId){

    let game=games[lobbyId];

    if(!game||!game.voting.activeNomination)
        return null;


    let counts={};

    Object.values(game.voting.executionVotes)
    .forEach(vote=>{
        counts[vote]=(counts[vote]||0)+1;
    });


    let winner=null;
    let highest=0;


    Object.keys(counts)
    .forEach(player=>{

        if(counts[player]>highest){

            highest=counts[player];
            winner=player;

        }

    });


    let alive=
        Object.values(game.players)
        .filter(p=>p.alive)
        .length;


    if(highest<Math.ceil(alive/2))
        winner=null;


    if(winner&&game.players[winner])
        game.players[winner].alive=false;


    game.voting.executionVotes={};
    game.voting.activeNomination=null;


    return winner;
}


function processBuildingDestruction(lobbyId){

    let game=games[lobbyId];

    if(!game)
        return null;


    let available=
        Object.keys(game.buildings)
        .filter(building=>
            !game.buildings[building].destroyed &&
            building!==BUILDINGS.FOREST
        );


    if(!available.length)
        return null;


    let counts=
        available.map(building=>
            game.buildings[building].players.length
        );


    let minimum=Math.min(...counts);


    let choices=
        available.filter(building=>
            game.buildings[building].players.length===minimum
        );


    let destroyed=
        choices[Math.floor(Math.random()*choices.length)];


    game.buildings[destroyed].destroyed=true;

    game.destroyedBuildings.push(destroyed);


    return destroyed;
}

function checkWinCondition(lobbyId){

    let game=games[lobbyId];

    if(!game)
        return null;


    let alive=
        Object.values(game.players)
        .filter(player=>player.alive);


    let wolves=
        alive.filter(player=>
            player.role===ROLES.WEREWOLF
        );


    let villagers=
        alive.filter(player=>
            player.role!==ROLES.WEREWOLF
        );


    if(wolves.length===0)
        return "villagers";


    if(wolves.length>=villagers.length)
        return "werewolves";


    return null;
}


function setPlayerLocation(lobbyId,username,building){

    let game=games[lobbyId];

    if(!game||
       !game.players[username]||
       !game.buildings[building])
        return false;


    let player=game.players[username];


    if(player.location){

        let old=game.buildings[player.location];

        if(old){

            let index=old.players.indexOf(username);

            if(index>-1)
                old.players.splice(index,1);
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


    if(!wolfPlayer||!targetPlayer)
        return false;


    return wolfPlayer.location===targetPlayer.location;
}


function getAlivePlayers(lobbyId){

    let game=games[lobbyId];

    if(!game)
        return [];


    return Object.values(game.players)
        .filter(player=>player.alive);
}


module.exports={
    ROLES,
    BUILDINGS,
    PHASES,

    getRoleConfig,
    initializeGame,

    getGame,

    resetGame,
    resetAllGames,

    advancePhase,

    processNightActions,
    processBuildingDestruction,
    processExecutionVotes,

    checkWinCondition,

    setPlayerLocation,
    canKill,

    getAlivePlayers
};