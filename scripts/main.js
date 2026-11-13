import * as server from "@minecraft/server";

// =======================
// Version 0.1.9
//
// Added
// - Opening title
// - First warning message
// - Water refresh every 10 ticks
//
// Changed
// - Deep ocean support
// - Water clear centered around player
// =======================

const SAFE_DISTANCE = 30;

const DARK_INTERVAL = 200;
const WARNING_INTERVAL =
Math.floor(DARK_INTERVAL / 2);

const WALL_HALF = 30;

const MIN_Y = -64;
const MAX_Y = 319;

// =======================
// 水処理
// =======================

const WATER_MIN_Y = -64;
const WATER_MAX_Y = 65;

// 左右7＋中心＋右7
const WATER_HALF = 7;

// 前後7＋中心
const WATER_FRONT = 7;

// 変更：20→10tick
const WATER_REFRESH_INTERVAL = 10;

// =======================

const WARNING_PARTICLE =
"minecraft:dragon_breath_trail";

const WARNING_RADIUS = 2;

// 状態

let deadline = null;

let tick = 0;

let waterTick = 0;

let gameScore = 0;

let lastPlayerX = null;
let lastPlayerZ = null;

let gameOver = false;

let maxDistance = 0;

let resultTitle = "";
let resultSub = "";

let openingShown = false;

let firstWarningShown = false;

// =======================

function getTotalXp(player){

const level = player.level;

if(level<=16)
return level*level+6*level;

if(level<=31)
return Math.floor(
2.5*level*level
-40.5*level
+360
);

return Math.floor(
4.5*level*level
-162.5*level
+2220
);

}

// =======================

function updateScore(player){

gameScore +=
getTotalXp(player);

player.onScreenDisplay
.setActionBar(
`§6Score: ${gameScore}`
);

}

// =======================

function showOpening(player){

if(openingShown)
return;

openingShown = true;

player.onScreenDisplay.setTitle(
"§5片道クラフト",
{
subtitle:
"§7闇から逃げ、生き延びろ",

fadeInDuration:10,
stayDuration:80,
fadeOutDuration:20
}
);

}

function showFirstWarning(player){

if(firstWarningShown)
return;

firstWarningShown = true;

player.onScreenDisplay.setTitle(
"§5闇が迫る",
{
subtitle:
"§7後方の闇が迫っています",

fadeInDuration:0,
stayDuration:50,
fadeOutDuration:10
}
);

}

// =======================

function showResult(player){

player.onScreenDisplay.setTitle(
resultTitle,
{
subtitle:
resultSub,

fadeInDuration:0,
stayDuration:999999,
fadeOutDuration:0
}
);

}

function finishRun(player){

if(gameOver)
return;

gameOver = true;

resultTitle =
`§6Score: ${gameScore}`;

resultSub =
`§aLevel: ${player.level}`;

showResult(player);

}

// =======================
// 水処理
// =======================

function clearWater(player){

const from =
`~-${WATER_HALF} ${WATER_MIN_Y} ~-${WATER_FRONT}`;

const to =
`~${WATER_HALF} ${WATER_MAX_Y} ~${WATER_FRONT}`;

const targets = [
"water",
"seagrass",
"tall_seagrass",
"kelp",
"kelp_plant"
];

for(const target of targets){

try{

player.runCommand(
`fill ${from} ${to} air replace ${target}`
);

}
catch{}

}

}

// =======================

function fillDeadline(player,z){

const px =
Math.floor(
player.location.x
);

try{

player.runCommand(

`fill ${
px-WALL_HALF
}
${MIN_Y}
${z}
${
px+WALL_HALF
}
${MAX_Y}
${z}
bedrock`

);

}
catch{}

clearWater(player);

}

// =======================

function showWarning(player){

const px =
Math.floor(
player.location.x
);

const py =
Math.floor(
player.location.y
)+1;

const z =
deadline+1;

for(
let ox=-WARNING_RADIUS;
ox<=WARNING_RADIUS;
ox++
){

for(
let oy=-WARNING_RADIUS;
oy<=WARNING_RADIUS;
oy++
){

try{

player.dimension.spawnParticle(

WARNING_PARTICLE,

{
x:px+ox,
y:py+oy,
z

}

);

}
catch{}

}

}

}

// =======================

function fillSideWalls(player){

try{

player.runCommand(
`fill ~-30 ${MIN_Y} ~1 ~-30 ${MAX_Y} ~-30 bedrock`
);

player.runCommand(
`fill ~30 ${MIN_Y} ~1 ~30 ${MAX_Y} ~-30 bedrock`
);

}
catch{}

clearWater(
player
);

}

// =======================

server.world.afterEvents
.entityDie
.subscribe(

(event)=>{

if(
event.deadEntity.typeId
!=="minecraft:player"
)
return;

finishRun(
event.deadEntity
);

}

);

// =======================

server.system.runInterval(()=>{

const player =
server.world.getAllPlayers()[0];

if(!player)
return;

if(gameOver){

showResult(player);

return;

}

// 水更新（変更）

waterTick++;

if(
waterTick>=
WATER_REFRESH_INTERVAL
){

waterTick=0;

clearWater(
player
);

}

const x =
Math.floor(
player.location.x
);

const z =
Math.floor(
player.location.z
);

if(
z>
maxDistance
)
maxDistance =
z;

// 初回

if(
deadline===null
){

deadline =
z-
SAFE_DISTANCE;

fillDeadline(
player,
deadline
);

fillSideWalls(
player
);

lastPlayerX =
x;

lastPlayerZ =
z;

showOpening(
player
);

return;

}

// 移動

if(

x!==lastPlayerX||

z!==lastPlayerZ

){

lastPlayerX =
x;

lastPlayerZ =
z;

fillSideWalls(
player
);

const target =
z-
SAFE_DISTANCE;

while(
deadline<
target
){

deadline++;

fillDeadline(
player,
deadline
);

}

}

// 初回予告

if(
tick===WARNING_INTERVAL
){

showFirstWarning(
player
);

}

// 予告

if(

tick>=WARNING_INTERVAL
&&
tick<DARK_INTERVAL
&&
tick%10===0

){

showWarning(
player
);

}

// 侵食

tick++;

if(
tick>=
DARK_INTERVAL
){

tick=0;

deadline++;

fillDeadline(
player,
deadline
);

updateScore(
player
);

}

},1);