import * as server from "@minecraft/server";

// =======================
// Version 0.3.0
//
// Changed
// - デッドラインを毎tick 0.005ブロックずつ前進させる方式に変更
// - プレイヤーの前進に合わせたデッドラインの追随を小数座標に対応
// - パーティクルを毎tick更新
// - スコア計算・スコア表示を撤廃
// - 死亡時は到達距離・生存時間・レベルを表示
// =======================

const SAFE_DISTANCE = 60;

// 1tick（0.05秒）ごとに0.05ブロック前進。
// 1秒あたり1ブロック。
const DEADLINE_SPEED = 0.05;

// 最初の予告タイトルを表示するまでの時間（5秒）
const FIRST_WARNING_TICKS = 100;

const WARNING_PARTICLE = "minecraft:dragon_breath_trail";
const WARNING_RADIUS = 5;
const FRONTLINE_PARTICLE = "minecraft:endrod";

// 状態
let deadline = null;
let gameOver = false;

let startZ = null;
let maxDistanceZ = null;
let elapsedTicks = 0;

let resultTitle = "";
let resultSub = "";

let openingShown = false;
let firstWarningShown = false;

// =======================

function showOpening(player) {
    if (openingShown)
        return;
    openingShown = true;

    player.onScreenDisplay.setTitle(
        "§5片道クラフト",
        {
            subtitle: "§7闇から逃げ、生き延びろ",
            fadeInDuration: 10,
            stayDuration: 80,
            fadeOutDuration: 20
        }
    );
}

function showFirstWarning(player) {
    if (firstWarningShown)
        return;

    firstWarningShown = true;
    player.onScreenDisplay.setTitle(
        "§5闇が迫る",
        {
            subtitle: "§7後方の闇が迫っています",
            fadeInDuration: 0,
            stayDuration: 50,
            fadeOutDuration: 10
        }
    );
}

// =======================
// 死亡時の結果表示
// =======================

function formatElapsedTime(ticks) {
    const totalSeconds = Math.floor(ticks / 20);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function showResult(player) {
    player.onScreenDisplay.setTitle(
        resultTitle,
        {
            subtitle: resultSub,
            fadeInDuration: 0,
            stayDuration: 999999,
            fadeOutDuration: 0
        }
    );
}

function finishRun(player) {
    if (gameOver)
        return;

    gameOver = true;

    const distance = Math.max(0, maxDistanceZ - startZ);
    resultTitle = `§6到達距離: ${distance.toFixed(1)}ブロック`;
    resultSub = `§a生存時間: ${formatElapsedTime(elapsedTicks)}  |  Level: ${player.level}`;

    showResult(player);
}

// =======================
// デッドラインの位置に予告パーティクルを表示
// 毎tick更新して滑らかに移動させる
// =======================


function showDeadlineParticles(player) {
    const location = player.location;

    // プレイヤー周辺のランダムな位置に1個だけ表示
    const x = location.x + (Math.random() * 2 - 1) * WARNING_RADIUS;
    const y = location.y + 1 + (Math.random() * 2 - 1) * WARNING_RADIUS;
    const z = deadline;

    try {
        player.dimension.spawnParticle(
            WARNING_PARTICLE,
            { x, y, z }
        );
        player.dimension.spawnParticle(
            FRONTLINE_PARTICLE,
            { x, y, z:z + SAFE_DISTANCE }
        );
    }
    catch {}
    
}


// =======================
// デッドラインより後方にいるプレイヤーを前方へ戻す
// X・Y座標は維持し、Z座標だけを変更する
// =======================


function enforceDeadline(players) {
    for (const player of players) {
        const location = player.location;

        if (location.z < deadline) {
            try {
                player.teleport({
                    x: location.x,
                    y: location.y,
                    z: deadline + 1
                });

                // 強制テレポート時にエンダーパールの効果音を再生
                player.playSound("mob.endermen.portal");
            }
            catch {}
        }
    }
}


// =======================

server.world.afterEvents.entityDie.subscribe((event) => {
    if (event.deadEntity.typeId !== "minecraft:player")
        return;

    finishRun(event.deadEntity);
});

// =======================

server.system.runInterval(() => {
    const players = server.world.getAllPlayers();
    const player = players[0];

    if (!player)
        return;

    if (gameOver) {
        showResult(player);
        return;
    }

    // 初回：プレイヤーの30ブロック後方にデッドラインを設定
    if (deadline === null) {
        startZ = player.location.z;
        maxDistanceZ = startZ;
        deadline = startZ - SAFE_DISTANCE;

        showOpening(player);
        return;
    }

    elapsedTicks++;

    // 最も前方にいるプレイヤーのZ座標を取得
    let furthestZ = player.location.z;

    for (const currentPlayer of players) {
        const z = currentPlayer.location.z;

        if (z > furthestZ)
            furthestZ = z;
    }

    if (furthestZ > maxDistanceZ)
        maxDistanceZ = furthestZ;

    // プレイヤーが前進した場合、デッドラインも安全距離を保って追随
    // 小数座標をそのまま使用し、整数座標への丸めを行わない
    const target = furthestZ - SAFE_DISTANCE;

    if (target > deadline)
        deadline = target;

    // デッドラインを毎tick少しずつ前進させる
    deadline += DEADLINE_SPEED;

    // 開始から5秒後に最初の警告タイトルを表示
    if (elapsedTicks >= FIRST_WARNING_TICKS)
        showFirstWarning(player);

    // デッドラインの位置を毎tickパーティクルで表示
    showDeadlineParticles(player);

    // 全プレイヤーを毎tickチェック。ラインより後方なら即座に前方へ戻す
    enforceDeadline(players);

}, 1);
