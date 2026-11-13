import * as server from "@minecraft/server";

// =======================
// Version 0.2.0
//
// Changed
// - 廃止：岩盤によるデッドライン・側面壁の生成
// - 廃止：水・海草・昆布の除去
// - 変更：デッドラインを越えたプレイヤーを毎tickテレポート
// =======================

const SAFE_DISTANCE = 30;

const DARK_INTERVAL = 200;
const WARNING_INTERVAL = Math.floor(DARK_INTERVAL / 2);

const WARNING_PARTICLE = "minecraft:dragon_breath_trail";
const WARNING_RADIUS = 2;

// 状態
let deadline = null;
let tick = 0;
let gameScore = 0;
let lastPlayerZ = null;
let gameOver = false;
let maxDistance = 0;

let resultTitle = "";
let resultSub = "";

let openingShown = false;
let firstWarningShown = false;

// =======================

function getTotalXp(player) {
    const level = player.level;

    if (level <= 16)
        return level * level + 6 * level;

    if (level <= 31)
        return Math.floor(
            2.5 * level * level
            - 40.5 * level
            + 360
        );

    return Math.floor(
        4.5 * level * level
        - 162.5 * level
        + 2220
    );
}

// =======================

function updateScore(player) {
    gameScore += getTotalXp(player);
    player.onScreenDisplay.setActionBar(`§6Score: ${gameScore}`);
}

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

    resultTitle = `§6Score: ${gameScore}`;
    resultSub = `§aLevel: ${player.level}`;

    showResult(player);
}

// =======================
// 闇の予告演出
// =======================

function showWarning(player) {
    const px = Math.floor(player.location.x);
    const py = Math.floor(player.location.y) + 1;
    const z = deadline + 1;

    for (let ox = -WARNING_RADIUS; ox <= WARNING_RADIUS; ox++) {
        for (let oy = -WARNING_RADIUS; oy <= WARNING_RADIUS; oy++) {
            try {
                player.dimension.spawnParticle(
                    WARNING_PARTICLE,
                    {
                        x: px + ox,
                        y: py + oy,
                        z
                    }
                );
            }
            catch {}
        }
    }
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

    // 初回
    if (deadline === null) {
        const z = Math.floor(player.location.z);

        deadline = z - SAFE_DISTANCE;
        lastPlayerZ = z;
        maxDistance = z;

        showOpening(player);
        return;
    }

    // 最も前方にいるプレイヤーの位置を基準にデッドラインを進める
    let furthestZ = Math.floor(player.location.z);

    for (const currentPlayer of players) {
        const z = Math.floor(currentPlayer.location.z);

        if (z > furthestZ)
            furthestZ = z;
    }

    if (furthestZ > maxDistance)
        maxDistance = furthestZ;

    // プレイヤーが前進し、安全距離が広がった場合はデッドラインを追随させる
    if (furthestZ !== lastPlayerZ) {
        lastPlayerZ = furthestZ;

        const target = furthestZ - SAFE_DISTANCE;

        while (deadline < target)
            deadline++;
    }

    // 侵食予告
    if (tick === WARNING_INTERVAL) {
        showFirstWarning(player);
    }

    if (
        tick >= WARNING_INTERVAL
        && tick < DARK_INTERVAL
        && tick % 10 === 0
    ) {
        showWarning(player);
    }

    // 侵食
    tick++;

    if (tick >= DARK_INTERVAL) {
        tick = 0;
        deadline++;
        updateScore(player);
    }

    // 全プレイヤーを毎tickチェック。ラインより後方なら即座に前方へ戻す
    enforceDeadline(players);

}, 1);
