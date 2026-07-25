let currentUsername=null,currentLobby=null,myRole=null,currentRole=null,currentPhase=null,phaseDuration=0,currentGameStarted=false,gameBuildings={},gamePlayers=[],isHost=false,phaseRemainingSeconds=0,phaseClockInterval=null;
let phaseReadyCount=0, phaseReadyRequired=0, readySubmitted=false;
let phaseAdvanceType='percent', phaseAdvanceValue=50;
let hostCanBypass=false;
console.log("client.JS LOADED");
const socket=io();
console.log("SOCKET CREATED");
function formatTime(seconds){
    let mins=Math.floor(seconds/60);
    let secs=Math.floor(seconds%60);
    return `${mins}:${secs.toString().padStart(2,'0')}`;
}

function updateGameUI(){
    console.log("=== updateGameUI called ===");

    // Log core state
    console.log("STATE:", {
        currentGameStarted,
        isHost,
        currentPhase,
        phaseRemainingSeconds
    });

    // Grab elements once + validate
    const hostSetup = document.getElementById("hostSetup");
    const startGameBtn = document.getElementById("startGameBtn");
    const gameControls = document.getElementById("gameControls");
    const gameStatus = document.getElementById("gameStatus");
    const phaseStatus = document.getElementById("phaseStatus");

    console.log("ELEMENT CHECK:", {
        hostSetup: !!hostSetup,
        startGameBtn: !!startGameBtn,
        gameControls: !!gameControls,
        gameStatus: !!gameStatus,
        phaseStatus: !!phaseStatus
        });

    // Compute values first (easier to debug)
    const hostSetupDisplay = currentGameStarted ? "none" : (isHost ? "block" : "none");
    const startBtnDisplay = currentGameStarted ? "none" : (isHost ? "block" : "none");
    const controlsDisplay = currentGameStarted ? "block" : "none";

    const gameStatusText = currentGameStarted ? "Game started." : "";
    const phaseStatusText = currentPhase ? `Current phase: ${currentPhase}` : "";

    console.log("COMPUTED UI:", {
        hostSetupDisplay,
        startBtnDisplay,
        controlsDisplay,
        gameStatusText,
        phaseStatusText
    });

    // Apply safely (avoid silent crashes)
    if(hostSetup) hostSetup.style.display = hostSetupDisplay;
    if(startGameBtn) startGameBtn.style.display = startBtnDisplay;
    if(gameControls) gameControls.style.display = controlsDisplay;
    if(gameStatus) gameStatus.innerText = gameStatusText;
    if(phaseStatus) phaseStatus.innerText = phaseStatusText;

    console.log("=== updateGameUI complete ===");
}function updateGameUI(){
    console.log("=== updateGameUI called ===");
    // Log core state
    console.log("STATE:", {
        currentGameStarted,
        isHost,
        currentPhase,
        phaseRemainingSeconds
    });

    // Grab elements once + validate
    const hostSetup = document.getElementById("hostSetup");
    const startGameBtn = document.getElementById("startGameBtn");
    const gameControls = document.getElementById("gameControls");
    const gameStatus = document.getElementById("gameStatus");
    const phaseStatus = document.getElementById("phaseStatus");

    console.log("ELEMENT CHECK:", {
        hostSetup: !!hostSetup,
        startGameBtn: !!startGameBtn,
        gameControls: !!gameControls,
        gameStatus: !!gameStatus,
        phaseStatus: !!phaseStatus
    });

    // Compute values first (easier to debug)
    const hostSetupDisplay = currentGameStarted ? "none" : (isHost ? "block" : "none");
    const startBtnDisplay = currentGameStarted ? "none" : (isHost ? "block" : "none");
    const controlsDisplay = currentGameStarted ? "block" : "none";

    const gameStatusText = currentGameStarted ? "Game started." : "";
    const phaseStatusText = currentPhase ? `Current phase: ${currentPhase}` : "";

    console.log("COMPUTED UI:", {
        hostSetupDisplay,
        startBtnDisplay,
        controlsDisplay,
        gameStatusText,
        phaseStatusText
    });

    // Apply safely (avoid silent crashes)
    if(hostSetup) hostSetup.style.display = hostSetupDisplay;
    if(startGameBtn) startGameBtn.style.display = startBtnDisplay;
    if(gameControls) gameControls.style.display = controlsDisplay;
    if(gameStatus) gameStatus.innerText = gameStatusText;
    if(phaseStatus) phaseStatus.innerText = phaseStatusText;
    console.log("=== updateGameUI complete ===");
}
function updateGameActionStatus(message){
    let status=document.getElementById("gameActionStatus");
    if(status) status.innerText=message||"";
}
function renderBuildingChooser(){
    let container=document.getElementById("buildingChooser");
    if(!container) return;
    if(!currentGameStarted || currentPhase!=="Night") {
        container.innerHTML="";
        return;
    }
    let options=`<option value="random" selected>Random</option>`;
    Object.keys(gameBuildings).forEach(building=>{
        let info=gameBuildings[building];
        let playerList = (info.players && info.players.length)
            ? ` [${info.players.join(", ")}]`
            : "";
        let label=building + (info.destroyed?" (destroyed)":"") + playerList;
        options+=`<option value="${building}" ${info.destroyed?"disabled":""}>${label}</option>`;
    });
    container.innerHTML=`<h4>Move to a Location</h4>
    <div style="font-size:0.85em; margin-top:0.25em; color:#555;">
    <br>
        Under the cover of darkness, Werewolves choose a target—but their attack only succeeds if:<br>
        1. A Werewolf is lurking in the same location as the target, OR<br>
        2. The target hides in a location that does not have a majority of total alive players, ties are not safe.<br>
        As dawn approaches, one building is destroyed each night… until only one remains.
    </div>
    <br>
        <select id="buildingSelect" onchange="moveToBuilding()">${options}</select>`;
}
function renderAbilityControls(){
    let container=document.getElementById("abilityControls");
    if(!container) return;
    if(!currentGameStarted || currentPhase!=="Night" || !currentRole){
        container.innerHTML="";
        return;
    }
    let otherPlayers = gamePlayers.filter(u=>u.username!==currentUsername && u.alive);
    if(currentRole==="Werewolf"){
        let options=`<option value="random" selected>🎲 Random</option><option value="none">🚫 No one</option>` 
            + otherPlayers.map(p=>`<option value="${p.username}">${p.username}</option>`).join("");
        container.innerHTML=`
            <h4>🐺 Werewolf Attack</h4>
            <div style="font-size:0.85em; margin-top:0.25em; color:#555;">
                🗡️ Choose a player in your building to attack, or select no one to skip the attack. <br>
            </div>
            <select id="attackTarget" onchange="submitWerewolfKill()">${options}</select>
        `;
    } else if(currentRole==="Seer"){ 
        let options=`<option value="random" selected>🎲 Random</option>` 
            + gamePlayers.map(p=>`<option value="${p.username}">${p.username}</option>`).join("");

        container.innerHTML=`
            <h4>🔮 Seer Investigation</h4>
            <div style="font-size:0.85em; margin-top:0.25em; color:#555;">
                👁️ Choose exactly two different players to investigate. You will learn whether either player is a Werewolf or Soldier. You may choose yourself. <br>
            </div>
            <div><label>🎯 Target 1:</label><select id="seerTarget1">${options}</select></div>
            <div><label>🎯 Target 2:</label><select id="seerTarget2">${options}</select></div>
            <br>
            <button onclick="submitSeerInvestigation()">🔍 Investigate</button>
            <p style="font-size:0.9em;margin-top:0.5em;">
                ❗ Targets must be different. If you choose the same explicit player for both targets, the action will fail.
            </p>
        `;
    } else if(currentRole==="Soldier" || currentRole==="Solder"){
        let options=`<option value="random" selected>🎲 Random</option>` 
            + gamePlayers.map(p=>`<option value="${p.username}">${p.username}</option>`).join("");
        container.innerHTML=`
            <h4>🛡️ Soldier Protection</h4>
            <div style="font-size:0.85em; margin-top:0.25em; color:#555;">
                🛡️ Choose a player to protect tonight. You cannot protect the same player on consecutive nights.
            </div>
            <br>
            <select id="protectTarget">${options}</select>
            <button onclick="submitSoldierProtection()">✨ Protect</button>
        `;
    } else {
        let villagerMessages = [
            "Just try not to die.",
            "Try not to look suspicious.",
            "Don't be sus.",
            "The weather sure is bleak today.",
            "I hope I don't get killed tonight.",
            "I hope no one thinks I'm a Werewolf.",
            "Stay calm and trust your instincts.",
            "Maybe the Werewolves will overlook me.",
            "I should probably avoid looking too nervous.",
            "Survive first. Ask questions later.",
            "I swear I'm just a normal villager.",
            "Nothing suspicious happening here.",
            "Why is everyone looking at me?",
            "I have a very normal villager schedule.",
            "The moon looks a little too bright tonight...",
            "I definitely do not know anything important.",
            "Trust me. Probably.",
            "I have no idea who the Werewolves are. 👀",
            "You are a lonely villager"
        ];
        let specialMessages = [
            "You may be special, but not in this game. Sorry!",
            "You were promised greatness. Unfortunately, you are a Villager.",
            "Your special ability is... surviving.",
            "Congratulations! Your power is having no power.",
            "The village needs ordinary people too.",
            "You have no ability. Try being suspicious anyway."
        ];

        let specialMessage = "You have no special ability.";
        if (Math.random() < 0.10) {
            specialMessage = `
                <p style="font-size:0.9em; color:#555; font-style:italic;">
                    ${specialMessages[Math.floor(Math.random() * specialMessages.length)]}
                </p>
            `;
        }
        let message = "You are a lolely villager.";
        if (Math.random() < 0.25) {
            message = `<p style="font-size:0.9em; color:#555; font-style:italic;">
                ${villagerMessages[Math.floor(Math.random() * villagerMessages.length)]}
            </p>`;
        }
        container.innerHTML = `
        ${specialMessage}
        ${message}
`;
}}

function renderVoteControls(){

    let container=document.getElementById("voteControls");
    if(!container) return;

    if(!currentGameStarted){
        container.innerHTML="";
        return;
    }

    let aliveUsers = gamePlayers.filter(u=>u.alive);

    let options = aliveUsers
        .map(p=>`<option value="${p.username}">${p.username}</option>`)
        .join("");


    // Only voting happens during Day
    if(currentPhase !== "Day"){
        container.innerHTML="";
        return;
    }


    // No nomination yet -> nominate
    if(!nominatedPlayer){

        container.innerHTML=`
            <h4>Nomination Vote</h4>
            <select id="nominationTarget" onchange="submitNominationVote(this.value)">
                <option value="">Select player</option>
                ${options}
            </select>
            <p>Needs 2 votes (12 seconds)</p>
        `;

    }

    // Someone was nominated -> execution
    else {

        container.innerHTML=`
            <h4>Execution Vote</h4>
            <p>Nominated: ${nominatedPlayer}</p>

            <select id="executionTarget" onchange="submitExecutionVote(this.value)">
                <option value="">Select vote</option>
                <option value="${nominatedPlayer}">
                    Execute ${nominatedPlayer}
                </option>
            </select>

            <p>Requires 50% of living players</p>
        `;
    }
}

function forceAdvance(){
    socket.emit('forceAdvancePhase');
}
function computeReadyRequirement(){
    let alive = gamePlayers.filter(p=>p.alive).length;
    let required = phaseReadyRequired || 0;
    if(!required){
        let value = phaseAdvanceValue || 50;
        if(phaseAdvanceType === 'count'){
            required = Math.min(Math.max(1, Number(value) || 1), alive);
        } else {
            required = Math.max(1, Math.ceil(alive * ((Number(value) || 50) / 100)));
        }
    }
    return Math.min(required, Math.max(1, alive));
}
function renderReadyControl(){
    let container = document.getElementById('readyControl');
    if(!container) return;
    if(!currentGameStarted){
        container.innerHTML = '';
        return;
    }
    let alive = gamePlayers.filter(p => p.alive).length;
    let readyCount = phaseReadyCount || 0;
    console.log("phaseReadyCount:", phaseReadyCount, typeof phaseReadyCount);
    console.log("===renderReadyControl:===")
    console.log("ready:",readyCount)
    let required = computeReadyRequirement();
    let readyPercent = alive 
        ? Math.round((readyCount / alive) * 100) 
        : 0;
    let thresholdText = phaseAdvanceType === 'percent'
        ? `${phaseAdvanceValue ?? 50}% of living players`
        : `${phaseAdvanceValue ?? 1} players`;
    let statusText = `Ready: ${readyCount} Required: ${required} (50% of living players)`;
    let btnHtml = readySubmitted
        ? `<div style="margin-top:8px; font-weight:bold;">Ready submitted</div>`
        : `<button onclick="submitReady()">I'm Ready</button>`;
    container.innerHTML = `
        <h4>Advance by Ready</h4>
        <div style="font-size:0.9em;color:#555;margin-bottom:6px;">
            When enough players submit ready, the server advances the phase.
        </div>
        <div style="margin-bottom:4px;">
            Threshold: ${thresholdText}
        </div>
        <div style="margin-bottom:8px;">
            ${statusText}
        </div>
        ${btnHtml}
    `;
}
function submitReady(){
    console.log("submitReady called")
    if(readySubmitted) return;
    socket.emit('submitPhaseReady');
    readySubmitted = true;
    renderReadyControl();
    console.log("submitReady ended")
}
socket.on('phaseReadyAccepted', () => {readySubmitted = true;renderReadyControl();});
function moveToBuilding(){
    let select=document.getElementById("buildingSelect");
    if(!select) return;
    let building=select.value;
    socket.emit("moveToBuilding",building);
}
function submitWerewolfKill(){
    let select=document.getElementById("attackTarget");
    if(!select) return;
    socket.emit("werewolfKill",select.value);
}
function submitSeerInvestigation(){
    let target1=document.getElementById("seerTarget1");
    let target2=document.getElementById("seerTarget2");
    if(target1 && target2 && target1.value === target2.value && target1.value !== "random"){
        updateGameActionStatus("Targets must be different.");
        return;
    }
    let targets=[];
    if(target1) targets.push(target1.value);
    if(target2) targets.push(target2.value);
    socket.emit("seerInvestigate",targets);
}
function submitSoldierProtection(){
    let select=document.getElementById("protectTarget");
    if(!select) return;
    socket.emit("soldierProtect",select.value);
}
function submitExecutionVote(){
    let select=document.getElementById("executionTarget");
    if(!select) return;
    socket.emit("executionVote",select.value);
}
function submitDayTimeVote(){
    let select=document.getElementById("nextDayTimeVote");
    if(!select) return;
    socket.emit("nightVoteDayTime",parseInt(select.value,10));
}
function submitNominationLimitVote(){
    let select=document.getElementById("nominationLimitVoteControl");
    if(!select) return;
    socket.emit("nightVoteNominationLimit",parseInt(select.value,10));
}
socket.on("connect",()=>{console.log("CLIENT CONNECTED:",socket.id);});
socket.on("hostChanged",data=>{
    isHost=data.newHost===currentUsername;
    if(btn) btn.style.display=isHost?"inline":"none";
    updateUserInfo();updateDebug();
    updateGameUI();
});
socket.on("settingsChanged",settings=>{console.log("Settings updated:",settings);});
socket.on("gameOver",data=>{alert("Game Over! Winner: "+data.winner);});
socket.on("nightResults",data=>{
    let msg="Night Results:\n";
    if(data.killed){
        msg+=data.killed+" was killed!\n";
    } else if(data.attackFailed){
        msg+="The werewolf attack failed.\n";
    } else {
        msg+="No one was killed.\n";
    }
    if(data.destroyed) msg+=data.destroyed+" was destroyed!\n";
    if(data.lost?.length) msg+="Lost in forest: "+data.lost.join(", ")+"\n";
    alert(msg);
});

socket.on("seerInvestigationResult",data=>{
    let msg=`Seer result: ${data.foundAny ? "Yes" : "No"}`;
    if(data.targets?.length) msg += ` (targets: ${data.targets.join(", ")})`;
    updateGameActionStatus(msg);
});
function testLogin(){console.log("BUTTON WORKS");}
function login(){
    console.log("LOGIN BUTTON CLICKED");
    let username=document.getElementById("username").value.trim();
    console.log("USERNAME:",username);
    socket.emit("login",username);
}
document.getElementById("loginBtn").addEventListener("click",login);
function createGame(){
    let lobbyName=document.getElementById("lobbyName").value.trim()||"abc";
    console.log("CREATE GAME CLICKED:",lobbyName);
    socket.emit("createGame",lobbyName);
}
socket.on("gameCreated",id=>{console.log("GAME CREATED:",id);});
socket.on("joinedLobby",lobbyId=>{currentLobby=lobbyId;updateUserInfo();});
socket.on("leftLobby",()=>{currentLobby=null;updateUserInfo();});
socket.on("joinSuccess",lobbyId=>{console.log("JOIN SUCCESS:",lobbyId);currentLobby=lobbyId;updateUserInfo();});
function updateUserInfo(){
    document.getElementById("userInfo").innerText="You are user \""+currentUsername+"\"";
    let lobbyText=currentLobby?"In lobby ["+currentLobby+"]":"Not in a lobby";
    document.getElementById("currentLobbyStatus").innerText=lobbyText;
}
socket.on("loginSuccess",data=>{
    console.log("LOGIN SUCCESS RECEIVED:",data);
    currentUsername=data.username;
    currentLobby=data.lobbyId;
    let msg="1) You are user \""+currentUsername+"\"";
    msg+=currentLobby?" 2) and in lobby "+currentLobby:" 3) and not in a lobby ";
    document.getElementById("userInfo").innerHTML=msg;
    document.getElementById("currentLobbyStatus").innerHTML=currentLobby?"In lobby ["+currentLobby+"]":"Not in a lobby";
});
socket.on("lobbySettingsUpdated",data=>{
    document.getElementById("buildingCount").value=data.buildingCount;
    if(document.getElementById("nightTime")) document.getElementById("nightTime").value=(data.initialNightTime||1);
    if(document.getElementById('advanceThresholdType') && typeof data.advanceThresholdType !== 'undefined'){
        document.getElementById('advanceThresholdType').value = data.advanceThresholdType;
        document.getElementById('advanceThresholdValue').value = data.advanceThresholdValue || (data.advanceThresholdType === 'percent' ? 50 : 1);
        phaseAdvanceType = data.advanceThresholdType;
        phaseAdvanceValue = data.advanceThresholdValue || phaseAdvanceValue;
    }
    if(typeof data.hostCanBypass !== 'undefined' && document.getElementById('hostCanBypass')){
        document.getElementById('hostCanBypass').checked = !!data.hostCanBypass;
        hostCanBypass = !!data.hostCanBypass;
    }
    renderReadyControl();
});
socket.on("lobbies",lobbies=>{
    let list=document.getElementById("lobbies");
    list.innerHTML="";
    lobbies.forEach(l=>{
        let li=document.createElement("li");
        li.innerHTML=`Lobby: ${l.id} | Host: ${l.host} | Players: ${l.playerCount} [${l.playerNames.join(", ")}]`;
        list.appendChild(li);
    });
    let lobby=lobbies.find(x=>x.id===currentLobby);
    isHost=lobby&&lobby.host===currentUsername;
    updateGameUI();
});
socket.on("gameError",msg=>alert(msg));
function updateSettings(){
    socket.emit("updateLobbySettings",{
        buildingCount: document.getElementById("buildingCount").value,
        initialNightTime: document.getElementById("nightTime") 
            ? document.getElementById("nightTime").value 
            : 1,

        advanceThresholdType: "percent",
        advanceThresholdValue: document.getElementById("advanceThresholdValue").value,

        hostCanBypass: document.getElementById('hostCanBypass')
            ? document.getElementById('hostCanBypass').checked 
            : false
    });
}

document.getElementById("buildingCount").addEventListener("change",updateSettings);
if(document.getElementById("nightTime")) document.getElementById("nightTime").addEventListener("change",updateSettings);
function startGame(){socket.emit("startGame");}
document.getElementById("startGameBtn").addEventListener("click",startGame);
socket.on("gameStarted",data=>{
    console.log("Game started:",data);
    currentGameStarted=true;
    currentPhase=data.phase;
    phaseDuration=data.phaseDuration||0;
    gameBuildings=data.buildings||{};
    gamePlayers=data.players||[];
    updateGameUI();
    renderBuildingChooser();
    renderAbilityControls();
    renderVoteControls();
    renderReadyControl();
    renderPlayerList();  
    updateGameActionStatus(`Game started. ${currentPhase} phase.`);
});

socket.on("yourRole",role=>{
    console.log("YOUR ROLE RECEIVED:",role);
    myRole=role;
    currentRole=role;
    let roleEl=document.getElementById("playerRole");
    if(!roleEl){
        roleEl=document.createElement("div");
        roleEl.id="playerRole";
        document.body.appendChild(roleEl);
    }
    roleEl.innerHTML="Your role: "+role;
    renderAbilityControls();
    renderVoteControls();
});
socket.on("locationUpdated",data=>{
    console.log("Location updated:",data);
    if(data.buildings) gameBuildings=data.buildings;
    renderBuildingChooser();
    updateGameActionStatus(`${data.username} moved to ${data.building}`);
});
socket.on("moveSuccess",data=>{
    updateGameActionStatus(`Moved to ${data.building}`);
});
socket.on("solderProtectionSubmitted",data=>{
    updateGameActionStatus(`Protected ${data.target}`);
});
socket.on("werewolfKillSubmitted",data=>{
    updateGameActionStatus(`Kill submitted: ${data.target}`);
});
socket.on("seerInvestigationSubmitted",data=>{
    updateGameActionStatus(`Investigation submitted: ${data.targets.join(", ")}`);
});
socket.on("executionVoteUpdate",data=>{
    updateGameActionStatus(`Vote recorded for ${data.target} (${JSON.stringify(data.counts)})`);
});
socket.on("executionResult",data=>{
    updateGameActionStatus(`${data.target} has been executed.`);
});
socket.on("nightVoteUpdate",data=>{
    updateGameActionStatus(`Night vote update (${data.type}): ${JSON.stringify(data.counts)}`);
});
socket.on("phaseChanged", data=>{
    currentPhase = data.phase;
    phaseDuration = data.phaseDuration || 0;
    gamePlayers = data.players || gamePlayers;
    gameBuildings = data.buildings || gameBuildings;
    readySubmitted = false;
    phaseReadyCount = 0;
    phaseReadyRequired = 0;
    updateGameUI();
    renderBuildingChooser();
    renderAbilityControls();
    renderVoteControls();
    renderReadyControl();
    updateGameActionStatus(`Phase changed to ${currentPhase}.`);
});
socket.on("actionError",msg=>{
    updateGameActionStatus(`Action error: ${msg}`);
});
function toggleThresholdInput() {
    const type = document.getElementById("advanceThresholdType").value;
}

function getRequiredSubmissions(aliveCount) {
    const type = document.getElementById("advanceThresholdType").value;
    if (type === "percent") {
        const percent = parseInt(document.getElementById("percentInput").value, 10) || 0;
        return Math.ceil((percent / 100) * aliveCount);
    } else {
        let count = parseInt(document.getElementById("countInput").value, 10) || 0;

        // Auto-cap at alive players
        return Math.min(count, aliveCount);
    }
}
socket.on('phaseReadyUpdate', data => {
    console.log("PHASE READY UPDATE RECEIVED:", data);
    phaseReadyCount = data.count;
    phaseReadyRequired = data.required;
    renderReadyControl();
});

function renderPlayerList(){
    let container = document.getElementById("playerList");
    if(!container) return;
    if(!gamePlayers.length){
        container.innerHTML = "";
        return;
    }
    let alivePlayers = gamePlayers.filter(p => p.alive);
    let deadPlayers = gamePlayers.filter(p => !p.alive);

    container.innerHTML = `
        <h4>Players</h4>

        <div>
            <b>Alive (${alivePlayers.length})</b>
            <ul>
                ${
                    alivePlayers.map(p =>
                        `<li style="color:green;">🟢 ${p.username}</li>`
                    ).join("")
                }
            </ul>
        </div>

        <div>
            <b>Dead (${deadPlayers.length})</b>
            <ul>
                ${
                    deadPlayers.map(p =>
                        `<li style="color:red;">💀 ${p.username}</li>`
                    ).join("")
                }
            </ul>
        </div>
    `;
}
