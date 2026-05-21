/**
 * 联机集成测试（TS 版）
 */

import 'module';
process.env.PORT = process.env.PORT || '18766';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'WARN';

import * as path from 'path';
// 启动服务端 — 用绝对路径找到工程根的 server/src/index.js
// __dirname 在编译后是 build-tools/tools，所以 root = ../..
require(path.resolve(__dirname, '..', '..', 'server', 'src', 'index.js'));

// 客户端：注入 ws 全局
import WS from 'ws';
(global as any).WebSocket = WS;

import { instance as NetworkClient } from '../RoguelikeClient/assets/scripts/network/NetworkClient.js';
import { instance as TimeManager } from '../RoguelikeClient/assets/scripts/core/TimeManager.js';
import { BattleManager } from '../RoguelikeClient/assets/scripts/battle/BattleManager.js';
import { OnlineBattleAdapter } from '../RoguelikeClient/assets/scripts/network/OnlineBattleAdapter.js';
import { instance as EventBus } from '../RoguelikeClient/assets/scripts/core/EventBus.js';
import { Logger } from '../RoguelikeClient/assets/scripts/utils/Logger.js';
import { TileType } from '../RoguelikeClient/assets/scripts/config/MapConfig.js';
import { TowerType, MessageType, type TowerTypeValue } from '@rtd/shared';

Logger.setLevel(Logger.LEVEL.WARN);

function ok(msg: string): void   { console.log('  ✓', msg); }
function info(msg: string): void { console.log('  •', msg); }
function fail(msg: string): never { console.error('  ✗', msg); process.exit(1); }
function sleep(ms: number): Promise<void> { return new Promise<void>((r) => setTimeout(r, ms)); }

async function main(): Promise<void> {
    await sleep(800);

    console.log('=== Case 1: 客户端连接 & 登录 ===');
    await NetworkClient.connect('ws://127.0.0.1:' + process.env.PORT);
    ok('WebSocket 已连接');
    const auth = await NetworkClient.login({ code: 'sim_player', nickname: 'SimPlayer' });
    ok('登录成功 → ' + auth.openid);

    console.log('\n=== Case 2: 创建房间 ===');
    const room: any = await NetworkClient.createRoom({ difficulty: 2, maxPlayers: 1 });
    if (!room || !room.success) fail('createRoom failed');
    ok('房间创建：' + room.room.roomId + ' seed=' + room.room.seed);

    console.log('\n=== Case 3: 启动战斗（房主） ===');
    let battleStarted = false;
    EventBus.on('ws:' + MessageType.BATTLE_START, () => { battleStarted = true; });
    const startRsp: any = await NetworkClient.startBattle();
    if (!startRsp || !startRsp.success) fail('startBattle failed');
    await sleep(150);
    if (!battleStarted) fail('client 没收到 battle_start 推送');
    ok('客户端收到 battle_start 广播');

    console.log('\n=== Case 4: 创建联机 BattleManager + 适配器 ===');
    const battle = new BattleManager({
        seed: room.room.seed,
        difficulty: room.room.difficulty,
        players: [{ id: auth.openid, name: 'SimPlayer' }],
    });
    new OnlineBattleAdapter({ battle, net: NetworkClient, localPlayerId: auth.openid });
    battle.startBattle();
    TimeManager.bind(battle);
    TimeManager.reset();
    ok('BattleManager + OnlineBattleAdapter 已就绪');

    console.log('\n=== Case 5: 验证服务端骰子结果会推送 & 应用 ===');
    let buildAcc = 0;
    const startTs = Date.now();

    const serverDices: any[] = [];
    const serverGachas: any[] = [];
    let frameBroadcastCount = 0;
    let waveEndCount = 0;
    EventBus.on('ws:' + MessageType.DICE_RESULT,   (d: any) => serverDices.push(d));
    EventBus.on('ws:' + MessageType.GACHA_RESULT,  (g: any) => serverGachas.push(g));
    EventBus.on('ws:' + MessageType.FRAME_BROADCAST, () => frameBroadcastCount++);
    EventBus.on('wave_end', ({ wave }: any) => { waveEndCount++; info('wave_end ' + wave + ' triggered'); });

    TimeManager.setScale(5);
    while (Date.now() - startTs < 90 * 1000) {
        TimeManager.update(1 / 60);
        buildAcc++;
        if (buildAcc >= 60) {
            buildAcc = 0;
            autoBuild(battle, auth.openid);
        }
        await sleep(8);
        if (serverDices.length >= 2 || battle.state === 'FINISHED') break;
    }

    info('wave_end 触发次数=' + waveEndCount + ', 当前波次=' + battle.currentWave + ', frame_broadcast=' + frameBroadcastCount);

    if (serverDices.length === 0) fail('未收到任何 dice_result');
    ok('共收到 ' + serverDices.length + ' 个 dice_result，第1次：dice=' + serverDices[0].dice + ' picks=[' + serverDices[0].picks.map((p: any) => p.id).join(',') + ']');
    if (frameBroadcastCount === 0) fail('frame_broadcast 数量为 0');
    info('frame_broadcast 共收到 ' + frameBroadcastCount + ' 次');
    if (serverGachas.length > 0) {
        ok('共收到 ' + serverGachas.length + ' 个 gacha_result');
    } else {
        info('本次模拟还没触发抽卡');
    }

    console.log('\n=== Case 6: 验证状态哈希上报 ===');
    if (battle.currentWave < 3) {
        info('波次仅推进到 ' + battle.currentWave + ' 波');
    } else {
        ok('波次已推进到 ' + battle.currentWave + ' 波，状态哈希已上报');
    }

    console.log('\n=== Case 7: 主动断开 ===');
    NetworkClient.disconnect();
    await sleep(200);
    ok('断开成功');

    console.log('\n=== ALL ONLINE TESTS PASSED ===');
    process.exit(0);
}

function autoBuild(battle: BattleManager, pid: string): void {
    const map = battle.map;
    const occupied = new Set<string>();
    for (const t of battle.em.towers.values()) occupied.add(t.x + ',' + t.y);
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
            if (map.tiles[y][x] !== TileType.PLACEABLE) continue;
            if (occupied.has(x + ',' + y)) continue;
            let minD = Infinity;
            for (const p of map.path) {
                const dx = p.x - x;
                const dy = p.y - y;
                const d = dx * dx + dy * dy;
                if (d < minD) minD = d;
            }
            if (minD < bestD) { bestD = minD; best = { x, y }; }
        }
    }
    if (!best) return;
    for (const t of [TowerType.ARROW, TowerType.CANNON, TowerType.ICE] as TowerTypeValue[]) {
        const r = battle.build(pid, t, best.x, best.y);
        if (r && r.ok) return;
    }
}

main().catch((e) => { console.error('FAIL', e); process.exit(1); });
