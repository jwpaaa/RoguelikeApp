/**
 * 集成测试：启服 → ws 客户端模拟登录/建房/加房/聊天/掷骰/抽卡/结算
 * ---------------------------------------------------------------
 * 在内存模式下跑（无 MongoDB / Redis 依赖），验证服务端完整流程。
 *
 * 用法：node test/run.js
 */

'use strict';

const path = require('path');
process.env.PORT = process.env.PORT || '18765';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'WARN';
const WebSocket = require('ws');
const { MessageType } = require('../src/shared/MessageTypes');

let _seq = 1;
function nextSeq() { return _seq++; }

/** 简单 promise 化的客户端 */
class Client {
    constructor(name) {
        this.name = name;
        this.openid = null;
        this.token = null;
        /** seq → resolve */
        this.pending = new Map();
        /** type → handler */
        this.listeners = new Map();
        this.ws = null;
    }
    connect(port) {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket('ws://127.0.0.1:' + port);
            this.ws.on('open', resolve);
            this.ws.on('error', reject);
            this.ws.on('message', (data) => {
                const msg = JSON.parse(data.toString('utf8'));
                if (msg.seq && this.pending.has(msg.seq)) {
                    const fn = this.pending.get(msg.seq);
                    this.pending.delete(msg.seq);
                    fn(msg);
                }
                const handlers = this.listeners.get(msg.type) || [];
                for (const h of handlers) h(msg);
            });
        });
    }
    on(type, fn) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(fn);
    }
    send(type, data) {
        const seq = nextSeq();
        const msg = { type, seq, timestamp: Date.now(), data };
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(seq);
                reject(new Error('timeout: ' + type));
            }, 5000);
            this.pending.set(seq, (rsp) => { clearTimeout(timer); resolve(rsp); });
            this.ws.send(JSON.stringify(msg));
        });
    }
    fire(type, data) {
        this.ws.send(JSON.stringify({ type, timestamp: Date.now(), data }));
    }
    close() { try { this.ws.close(); } catch (_e) {} }
}

function assert(cond, msg) { if (!cond) { console.error('FAIL:', msg); process.exit(1); } }
function ok(msg) { console.log('  ✓', msg); }

async function main() {
    // 启服
    console.log('=== 启动服务端（内存模式）===');
    require(path.join(__dirname, '..', 'src', 'index.js'));
    await sleep(800);
    const port = parseInt(process.env.PORT, 10);

    // ---- 用例 1：双玩家登录 ----
    console.log('\n=== Case 1: 登录 ===');
    const alice = new Client('alice');
    const bob   = new Client('bob');
    await alice.connect(port);
    await bob.connect(port);
    const a1 = await alice.send(MessageType.AUTH_LOGIN, { code: 'alice_code', nickname: 'Alice' });
    assert(a1.data && a1.data.openid, 'alice login ok');
    alice.openid = a1.data.openid;
    alice.token  = a1.data.token;
    ok('alice login → ' + alice.openid);

    const b1 = await bob.send(MessageType.AUTH_LOGIN, { code: 'bob_code', nickname: 'Bob' });
    assert(b1.data && b1.data.openid, 'bob login ok');
    bob.openid = b1.data.openid;
    bob.token  = b1.data.token;
    ok('bob login → ' + bob.openid);

    // ---- 用例 2：创建/加入房间 ----
    console.log('\n=== Case 2: 房间 ===');
    const c1 = await alice.send(MessageType.CREATE_ROOM, { name: 'Alice', difficulty: 2, maxPlayers: 4 });
    assert(c1.data && c1.data.success, 'create_room success');
    const roomId = c1.data.room.roomId;
    ok('room created ' + roomId);

    let bobGotRoomUpdate = false;
    bob.on(MessageType.ROOM_UPDATE, () => { bobGotRoomUpdate = true; });
    const j1 = await bob.send(MessageType.JOIN_ROOM, { name: 'Bob', roomId });
    assert(j1.data && j1.data.success, 'bob joined');
    assert(j1.data.room.players.length === 2, 'room has 2 players');
    ok('bob joined ' + roomId + ' (players=' + j1.data.room.players.length + ')');

    await sleep(80);
    assert(bobGotRoomUpdate, 'bob got room_update broadcast');
    ok('room_update broadcast delivered');

    // ---- 用例 3：准备 + 战斗开始 ----
    console.log('\n=== Case 3: 战斗启动 ===');
    await alice.send(MessageType.PLAYER_READY, { ready: true });
    await bob.send(MessageType.PLAYER_READY, { ready: true });
    let aliceGotStart = false; let bobGotStart = false;
    alice.on(MessageType.BATTLE_START, (m) => { aliceGotStart = true; ok('alice got battle_start seed=' + m.data.seed); });
    bob.on(MessageType.BATTLE_START,   () => { bobGotStart = true; });
    const start = await alice.send(MessageType.BATTLE_START, {});
    assert(start.data && start.data.success, 'battle_start success');
    await sleep(150);
    assert(aliceGotStart && bobGotStart, 'both got battle_start');
    ok('both clients received battle_start');

    // ---- 用例 4：帧输入转发 ----
    console.log('\n=== Case 4: 帧同步 ===');
    let bobGotFrame = false; let aliceGotFrame = false;
    bob.on(MessageType.FRAME_BROADCAST, (m) => {
        bobGotFrame = true;
        // 应包含两位玩家的输入
        assert(m.data.inputs[alice.openid], 'frame has alice');
        assert(m.data.inputs[bob.openid],   'frame has bob');
    });
    alice.on(MessageType.FRAME_BROADCAST, () => { aliceGotFrame = true; });
    alice.fire(MessageType.FRAME_INPUT, { frameId: 0, actions: [{ type: 'PLACE_TOWER', x: 5, y: 7, towerType: 'ARROW' }] });
    bob.fire(MessageType.FRAME_INPUT,   { frameId: 0, actions: [{ type: 'PLACE_TOWER', x: 6, y: 7, towerType: 'CANNON' }] });
    await sleep(200);
    assert(aliceGotFrame && bobGotFrame, 'both got frame_broadcast');
    ok('frame_broadcast received by both players');

    // ---- 用例 5：服务端骰子 + 抽卡 ----
    console.log('\n=== Case 5: 骰子 / 抽卡 ===');
    const dice = await alice.send('roll_dice', { waveNumber: 3 });
    assert(dice.data && typeof dice.data.dice === 'number' && dice.data.dice >= 1 && dice.data.dice <= 6, 'dice 1-6');
    assert(Array.isArray(dice.data.picks) && dice.data.picks.length === 3, '3 picks');
    ok('alice rolled ' + dice.data.dice + ' picks=[' + dice.data.picks.map((p) => p.id).join(',') + ']');

    const gacha = await alice.send('draw_gacha', { waveNumber: 3 });
    assert(gacha.data && gacha.data.card, 'gacha card');
    ok('alice drew ' + gacha.data.rarity + ' ' + gacha.data.card.name);

    // ---- 用例 6：聊天广播 ----
    console.log('\n=== Case 6: 聊天 ===');
    let bobGotChat = false;
    bob.on(MessageType.CHAT_MESSAGE, (m) => { if (m.data.fromId === alice.openid) bobGotChat = true; });
    await alice.send(MessageType.CHAT_MESSAGE, { text: 'hi bob' });
    await sleep(100);
    assert(bobGotChat, 'bob got chat');
    ok('chat delivered');

    // ---- 用例 7：聊天频率限制 ----
    console.log('\n=== Case 7: 频率限制 ===');
    let limited = false;
    for (let i = 0; i < 8; i++) {
        const r = await alice.send(MessageType.CHAT_MESSAGE, { text: 'spam ' + i });
        if (r.data && r.data.error && r.data.code === 'LIMIT') { limited = true; break; }
    }
    assert(limited, 'rate limit triggered');
    ok('rate limit triggered correctly');

    // ---- 用例 8：结算 + 存档 ----
    console.log('\n=== Case 8: 结算 ===');
    let aliceGotGameOver = false;
    alice.on(MessageType.GAME_OVER, () => { aliceGotGameOver = true; });
    const over = await alice.send(MessageType.GAME_OVER, {
        win: true, wave: 20, kills: 234, leaks: 1, crystalHp: 3, score: { score: 92, grade: 'A' },
    });
    assert(over.data && over.data.success, 'game_over success');
    await sleep(100);
    assert(aliceGotGameOver, 'broadcast game_over');
    ok('game_over broadcast');

    // ---- 用例 9：踢人 ----
    console.log('\n=== Case 9: 踢人 ===');
    // 新建一房做隔离
    await alice.send(MessageType.LEAVE_ROOM, {});
    await bob.send(MessageType.LEAVE_ROOM, {});
    const c2 = await alice.send(MessageType.CREATE_ROOM, { name: 'Alice', difficulty: 1, maxPlayers: 4 });
    const rid2 = c2.data.room.roomId;
    await bob.send(MessageType.JOIN_ROOM, { name: 'Bob', roomId: rid2 });
    const k = await alice.send(MessageType.KICK_PLAYER, { targetId: bob.openid });
    assert(k.data && k.data.success, 'kick success');
    ok('kick player success');

    // ---- 用例 10：重连（rebindConnection） ----
    console.log('\n=== Case 10: 重连 ===');
    // bob 退出当前连接 → 新 conn → reconnect
    bob.close();
    await sleep(100);
    const bob2 = new Client('bob2');
    await bob2.connect(port);
    const rc = await bob2.send(MessageType.RECONNECT, { token: bob.token });
    assert(rc.data && rc.data.success, 'reconnect success');
    ok('reconnect rebind ok');

    // ---- 用例 11：未登录访问 ----
    console.log('\n=== Case 11: 鉴权 ===');
    const carol = new Client('carol');
    await carol.connect(port);
    const cc = await carol.send(MessageType.CREATE_ROOM, { difficulty: 2 });
    assert(cc.type === MessageType.ERROR || (cc.data && cc.data.error), 'unauthorized rejected');
    ok('未登录被拦截');

    console.log('\n=== ALL TESTS PASSED ===');
    process.exit(0);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
main().catch((e) => { console.error('TEST FAIL', e); process.exit(1); });
